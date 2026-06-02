import * as path from 'path';
import * as fs from 'fs';

/**
 * 获取适用于当前数据库类型的迁移文件列表
 * - 通用文件（不含 -sqlite / -postgres 后缀）始终包含
 * - 特定文件仅匹配当前 dbType 后缀
 */
async function runSafeRebuildMigration(db: any, statements: string[], file: string): Promise<void> {
  console.log(`  [安全模式] 处理迁移文件: ${file}`);
  console.log(`  [安全模式] 检测到重建表迁移，将验证数据完整性...`);

  // 分类 SQL 语句
  const createStmts: string[] = [];
  const insertStmts: string[] = [];
  let dropAndRename: { drop: string; rename: string }[] = [];

  for (const stmt of statements) {
    const trimmed = stmt.trim().toUpperCase();
    if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS')) {
      createStmts.push(stmt);
    } else if (trimmed.startsWith('INSERT')) {
      insertStmts.push(stmt);
    } else if (trimmed.startsWith('DROP TABLE')) {
      if (!dropAndRename) dropAndRename = [];
      dropAndRename.push({ drop: stmt, rename: '' });
    } else if (trimmed.startsWith('ALTER TABLE') && trimmed.includes('RENAME')) {
      if (dropAndRename.length > 0) {
        dropAndRename[dropAndRename.length - 1].rename = stmt;
      }
    } else {
      // 其他语句（PRAGMA 等）直接执行
      try { await db.run(stmt); } catch (e: any) { /* 忽略已存在错误 */ }
    }
  }

  // 1. 创建新表
  for (const stmt of createStmts) {
    try { await db.run(stmt); } catch (e: any) {
      console.log(`  创建新表: ${stmt.substring(0, 60)}...`);
    }
  }

  // 2. 插入数据
  for (const stmt of insertStmts) {
    try { await db.run(stmt); } catch (e: any) {
      console.error(`  插入数据失败: ${e.message}`);
    }
  }

  // 3. 验证数据完整性并决定是否替换
  const tables = ['skins', 'capes'];
  let allVerified = true;

  for (const table of tables) {
    const newTable = table + '_new';
    // 检查新表是否存在
    const newTableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [newTable]
    );

    if (!newTableExists) continue;

    // 检查旧表是否存在
    const oldTableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [table]
    );

    if (!oldTableExists) {
      // 旧表不存在，直接重命名
      console.log(`  ${table}: 旧表不存在，直接重命名`);
      await db.run(`DROP TABLE IF EXISTS ${newTable}`);
      await db.run(`ALTER TABLE ${newTable} RENAME TO ${table}`);
      continue;
    }

    // 比较行数
    const oldCount = await db.get(`SELECT COUNT(*) as cnt FROM ${table}`);
    const newCount = await db.get(`SELECT COUNT(*) as cnt FROM ${newTable}`);

    console.log(`  ${table}: 旧表 ${oldCount.cnt} 行, 新表 ${newCount.cnt} 行`);

    if (oldCount.cnt > 0 && newCount.cnt === 0) {
      // 旧表有数据，但新表是空的 -> 插入失败，不替换
      console.error(`  ❌ ${table}: 数据迁移失败！保留原表，不执行替换`);
      allVerified = false;
    } else if (newCount.cnt >= oldCount.cnt) {
      // 新表数据完整，执行替换
      console.log(`  ✅ ${table}: 数据验证通过，执行替换...`);
      await db.run(`DROP TABLE ${table}`);
      await db.run(`ALTER TABLE ${newTable} RENAME TO ${table}`);
    }
  }

  if (!allVerified) {
    console.error(`[migrate] ❌ ${file} 数据验证失败，已保留原表。请检查迁移文件！`);
    // 不抛出错误，让服务器继续启动（原表还在）
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
