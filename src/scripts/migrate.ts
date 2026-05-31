import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbType = process.env.DB_TYPE || 'postgres';

console.log(`数据库类型: ${dbType}`);

function getMigrationFiles(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(suffix + '.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.split('-')[0]) || 0;
      const numB = parseInt(b.split('-')[0]) || 0;
      return numA - numB;
    });
}

// 去掉一条语句块开头的空行与 `--` 行注释，得到首个有意义的 SQL，
// 用于判断该块是否为纯注释（应跳过）或 `PRAGMA foreign_keys`（事务内 no-op，应跳过）。
function stripLeadingComments(stmt: string): string {
  const lines = stmt.split(/\r?\n/);
  const kept: string[] = [];
  let started = false;
  for (const line of lines) {
    if (!started) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('--')) continue;
      started = true;
    }
    kept.push(line);
  }
  return kept.join('\n').trim();
}

async function runMigrations() {
  if (dbType === 'sqlite') {
    await runSqliteMigrations();
  } else {
    await runPostgresMigrations();
  }
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
    // 在执行 010 之前，自动完成 INTEGER→TEXT 主键迁移。
    // 历史上这是个独立手动脚本（必须在 010 之前跑），不在 migrations 目录内，
    // 造成“隐式手动步骤”的部署陷阱。此处自动调用并自守卫：
    //   - skins.id 已是 TEXT（现部署 / 全新安装 / 已迁移库）→ 直接跳过，零影响；
    //   - 仅旧 INTEGER 库会真正执行，且整体事务化，失败回滚。
    const fileNum = parseInt(file.split('-')[0]) || 0;
    if (fileNum >= 10) {
      try {
        const { migrateToStringIds } = require('./migrate_to_string_ids');
        const result = await migrateToStringIds(db);
        if (!result.skipped) {
          console.log('[SQLite] 已自动完成 INTEGER→TEXT 主键迁移（在 010 之前）');
        }
      } catch (err: any) {
        console.error(`  INTEGER→TEXT 主键迁移失败（已回滚）: ${err?.message ?? err}`);
        console.error('  中止后续迁移：010+ 依赖 TEXT 主键，请修复后重试。');
        break;
      }
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    // 拆分语句，并对每个语句块剥离前导注释/空行后得到“有效 SQL”。
    // 过滤掉两类块：
    //   1) 纯注释/空白块（无有效 SQL）；
    //   2) 内联的 `PRAGMA foreign_keys = ...`：在事务内是 no-op，
    //      外键开关改为在事务外统一处理（见下方 OFF/ON）。
    const statements = sql
      .split(';')
      .map(raw => ({ raw, effective: stripLeadingComments(raw) }))
      .filter(({ effective }) => {
        if (effective.length === 0) return false;
        if (/^PRAGMA\s+foreign_keys\b/i.test(effective)) return false;
        return true;
      })
      .map(({ effective }) => effective);

    console.log(`[SQLite] 执行: ${file}`);

    // 整个文件作为一个原子单元执行：
    //   - 外键开关必须在事务外设置（事务内 PRAGMA foreign_keys 不生效）。
    //     破坏性迁移（建新表 / 拷贝 / DROP / RENAME）依赖迁移期间关闭外键。
    //   - 任意语句出现非预期错误 → 整文件 ROLLBACK，记录并继续下一个文件。
    //   - "already exists" / "duplicate column name" 视为幂等 no-op，
    //     跳过该单条语句并在同一事务内继续（支持重复执行）。
    await db.run('PRAGMA foreign_keys = OFF');
    await db.run('BEGIN IMMEDIATE');

    try {
      for (const stmt of statements) {
        try {
          await db.run(stmt);
        } catch (err: any) {
          const msg = String(err?.message ?? '');
          if (msg.includes('already exists') || msg.includes('duplicate column name')) {
            // 幂等：该语句此前已应用，跳过但保持事务可用，继续后续语句。
            continue;
          }
          // 非预期错误：抛出以触发整文件回滚。
          throw err;
        }
      }
      await db.run('COMMIT');
    } catch (err: any) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr: any) {
        console.error(`  回滚失败: ${rollbackErr?.message ?? rollbackErr}`);
      }
      console.error(`  失败文件: ${file}（已回滚，数据库保持不变）`);
      console.error(`  错误: ${err?.message ?? err}`);
      // 跨文件容错：不中断，继续下一个文件。
    } finally {
      // 在事务外恢复外键约束。
      await db.run('PRAGMA foreign_keys = ON');
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

      console.log(`[PostgreSQL] 执行: ${file}`);
      try {
        await pool.query(sql);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.error(`  失败: ${file}`);
          console.error(`  错误: ${err.message}`);
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

runMigrations().catch(err => {
  console.error('Migration 运行失败:', err);
  process.exit(1);
});
