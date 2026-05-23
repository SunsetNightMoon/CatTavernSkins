const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbType = process.env.DB_TYPE || 'postgres';

console.log(`数据库类型: ${dbType}`);

if (dbType === 'sqlite') {
  // SQLite 迁移
  const sqlite3 = require('sqlite3');
  const { open } = require('sqlite');
  
  (async () => {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/skin_server.db');
    const dbDir = path.dirname(dbPath);
    
    // 确保目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    console.log(`SQLite 数据库路径: ${dbPath}`);
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // 读取迁移脚本
    const migrationPath = path.join(__dirname, '../database/migrations/001-init-sqlite.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // 执行迁移（分割多条 SQL 语句）
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const stmt of statements) {
      try {
        await db.run(stmt);
        console.log(`执行成功: ${stmt.substring(0, 50)}...`);
      } catch (err) {
        console.error(`执行失败: ${stmt.substring(0, 50)}...`);
        console.error(err.message);
      }
    }
    
    console.log('SQLite 数据库迁移完成！');
    await db.close();
  })();
  
} else {
  // PostgreSQL 迁移
  const { Pool } = require('pg');
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'skin_server',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  });
  
  (async () => {
    try {
      // 读取迁移脚本
      const migrationPath = path.join(__dirname, '../database/migrations/001-init-postgres.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // 执行迁移
      await pool.query(sql);
      
      console.log('PostgreSQL 数据库迁移完成！');
    } catch (err) {
      console.error('数据库迁移失败:', err.message);
    } finally {
      await pool.end();
    }
  })();
}
