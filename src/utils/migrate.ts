import * as path from 'path';
import * as fs from 'fs';

/**
 * 获取适用于当前数据库类型的迁移文件列表
 * - 通用文件（不含 -sqlite / -postgres 后缀）始终包含
 * - 特定文件仅匹配当前 dbType 后缀
 */
/**
 * 安全地执行“重建表”型迁移（SQLite 改 CHECK 约束必须重建表）。
 *
 * 修复的历史问题（详见仓库 Dev/master 合并记录）：
 *  1. 旧实现用 `stmt.trim().startsWith('INSERT')` 分类，但 SQL 里 INSERT 前有 `--` 注释，
 *     导致分类失败、在新表创建前被当作“其他语句”执行 → 静默失败 → 新表为空 →
 *     行数校验拒绝替换 → CHECK 约束永远加不上（数据虽不丢，但迁移目的从未达成）。
 *     现在：分类前先剥离前导注释。
 *  2. 非事务化：CREATE/INSERT/DROP/RENAME 分步裸跑，中途崩溃可能丢表。
 *     现在：整体包在一个事务里，任何错误都 ROLLBACK，绝不留半成品。
 *  3. 每次启动都重建表，浪费且有风险。
 *     现在：幂等守卫——基表的 license_type CHECK 已是期望值则直接跳过。
 *  4. 残留的空 *_new 孤儿表会污染重建。
 *     现在：重建前先 DROP IF EXISTS 清干净。
 *  5. 行数校验过宽（仅判断“非空”）。
 *     现在：新表行数 < 旧表 → 视为丢数据 → 回滚。
 */
async function runSafeRebuildMigration(db: any, statements: string[], file: string): Promise<void> {
  console.log(`  [安全模式] 处理迁移文件: ${file}`);

  // 剥离一条语句块的前导 `--` 注释/空行，得到首个有效 SQL，用于稳健分类。
  const stripComments = (stmt: string): string =>
    stmt.split(/\r?\n/).filter(l => {
      const t = l.trim();
      return t !== '' && !t.startsWith('--');
    }).join('\n').trim();

  // 提取 license_type CHECK 的允许值集合（去空格/引号），用于幂等比较。无该 CHECK 返回 null。
  const licenseAllowed = (sql: string): string | null => {
    const m = sql.match(/CHECK\s*\(\s*license_type\s+IN\s*\(([^)]*)\)/i);
    return m ? m[1].replace(/[\s']/g, '') : null;
  };

  // 仅挑 CREATE TABLE / INSERT（注释剥离后判断）。PRAGMA/SELECT/DROP/ALTER 一律忽略——
  // 外键开关与删表改名改由本函数统一、事务化地控制。
  const createStmts: string[] = [];
  const insertStmts: string[] = [];
  for (const raw of statements) {
    const eff = stripComments(raw);
    if (!eff) continue;
    const u = eff.toUpperCase();
    if (u.startsWith('CREATE TABLE')) createStmts.push(eff);
    else if (u.startsWith('INSERT')) insertStmts.push(eff);
  }

  // 从 CREATE 语句解析重建目标：xxx_new -> 基表 xxx。
  const targets: { tmp: string; base: string; createSql: string }[] = [];
  for (const c of createStmts) {
    const m = c.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([A-Za-z0-9_]+)/i);
    if (m && m[1].endsWith('_new')) {
      targets.push({ tmp: m[1], base: m[1].slice(0, -4), createSql: c });
    }
  }
  if (targets.length === 0) {
    console.log(`  [安全模式] 未发现 *_new 重建目标，跳过: ${file}`);
    return;
  }

  // 幂等守卫：所有基表的 license_type CHECK 都已与目标一致 → 此前已成功应用，跳过。
  let allApplied = true;
  for (const t of targets) {
    const baseRow = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [t.base]);
    const want = licenseAllowed(t.createSql);
    if (!baseRow || !want || licenseAllowed(baseRow.sql) !== want) { allApplied = false; break; }
  }
  if (allApplied) {
    console.log(`  [安全模式] 目标表 CHECK 约束已是最新，跳过: ${file}`);
    return;
  }

  console.log(`  [安全模式] 检测到重建表迁移，开始事务化重建并校验数据完整性...`);

  // 外键开关必须在事务外设置（事务内 PRAGMA foreign_keys 为 no-op）。
  await db.run('PRAGMA foreign_keys = OFF');
  await db.run('BEGIN IMMEDIATE');
  try {
    // 0. 清理残留的孤儿 *_new 表，确保从干净状态重建。
    for (const t of targets) await db.run(`DROP TABLE IF EXISTS ${t.tmp}`);
    // 1. 建新表（含新 CHECK 约束）。
    for (const c of createStmts) await db.run(c);
    // 2. 拷数据（SQL 显式列名 + 非法 license 归一到 ARR，保证不丢列、不违反 CHECK）。
    for (const ins of insertStmts) await db.run(ins);
    // 3. 逐表校验并替换。
    for (const t of targets) {
      const baseExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [t.base]);
      if (!baseExists) {
        await db.run(`ALTER TABLE ${t.tmp} RENAME TO ${t.base}`);
        console.log(`  ${t.base}: 基表不存在，直接启用新表`);
        continue;
      }
      const oldCount = (await db.get(`SELECT COUNT(*) AS c FROM ${t.base}`)).c;
      const newCount = (await db.get(`SELECT COUNT(*) AS c FROM ${t.tmp}`)).c;
      if (newCount < oldCount) {
        throw new Error(`${t.base} 行数校验失败：旧 ${oldCount} -> 新 ${newCount}，疑似丢数据`);
      }
      await db.run(`DROP TABLE ${t.base}`);
      await db.run(`ALTER TABLE ${t.tmp} RENAME TO ${t.base}`);
      console.log(`  ✅ ${t.base}: 校验通过（${oldCount} 行），已替换`);
    }
    await db.run('COMMIT');
    console.log(`  [安全模式] ${file} 重建完成`);
  } catch (err: any) {
    try { await db.run('ROLLBACK'); } catch { /* ignore */ }
    console.error(`  ❌ ${file} 重建失败，已回滚，原表数据保持不变: ${err?.message ?? err}`);
  } finally {
    await db.run('PRAGMA foreign_keys = ON');
  }
}

function getMigrationFiles(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
  const applicable = allFiles.filter(f => {
    if (f.includes('-sqlite') || f.includes('-postgres')) {
      return f.endsWith(suffix + '.sql');
    }
    return true; // 通用文件
  });
  // 按编号排序
  applicable.sort((a, b) => {
    const numA = parseInt(a.split('-')[0]) || 0;
    const numB = parseInt(b.split('-')[0]) || 0;
    return numA - numB;
  });
  return applicable;
}

export async function runMigrations(dbType: string): Promise<void> {
  console.log('[migrate] 开始执行数据库迁移...');
  if (dbType === 'sqlite') {
    await runSqliteMigrations();
  } else {
    await runPostgresMigrations();
  }
  console.log('[migrate] 数据库迁移完成');
}

async function runSqliteMigrations() {
  const sqlite3 = require('sqlite3');
  const { open } = require('sqlite');

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/skin_server.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`SQLite 数据库路径: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.run('PRAGMA foreign_keys = ON');

  const migrationsDir = path.join(__dirname, '../../database/migrations');
  const files = getMigrationFiles(migrationsDir, '-sqlite');

  console.log(`找到 ${files.length} 个 SQLite migration 文件:`, files);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    console.log(`[SQLite] 执行: ${file}`);

    // 检测是否为重建表迁移（包含 CREATE TABLE *_new 和 DROP TABLE）
    const isRebuildMigration = sql.includes('_new') && sql.includes('DROP TABLE');

    if (isRebuildMigration) {
      await runSafeRebuildMigration(db, statements, file);
    } else {
      for (const stmt of statements) {
        try {
          await db.run(stmt);
        } catch (err: any) {
          const msg = err.message || '';
          if (
            !msg.includes('already exists') &&
            !msg.includes('duplicate column name') &&
            !msg.includes('not an error')
          ) {
            console.error(`  失败: ${stmt.substring(0, 60)}...`);
            console.error(`  错误: ${err.message}`);
          }
        }
      }
    }
  }

  console.log('SQLite migration 完成！');
  await db.close();
}

async function runPostgresMigrations() {
  const { Pool } = require('pg');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'skin_server',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  });

  try {
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const files = getMigrationFiles(migrationsDir, '-postgres');

    console.log(`找到 ${files.length} 个 PostgreSQL migration 文件:`, files);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

      console.log(`[PostgreSQL] 执行: ${file}`);
      for (const stmt of statements) {
        try {
          await pool.query(stmt);
        } catch (err: any) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate_column')) {
            console.error(`  失败: ${stmt.substring(0, 60)}...`);
            console.error(`  错误: ${err.message}`);
          }
        }
      }
    }

    console.log('PostgreSQL migration 完成！');
  } catch (err: any) {
    console.error('Migration 失败:', err.message);
  } finally {
    await pool.end();
  }
}
