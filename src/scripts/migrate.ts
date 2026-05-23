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
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    console.log(`[SQLite] 执行: ${file}`);
    for (const stmt of statements) {
      try {
        await db.run(stmt);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.error(`  失败: ${stmt.substring(0, 60)}...`);
          console.error(`  错误: ${err.message}`);
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
