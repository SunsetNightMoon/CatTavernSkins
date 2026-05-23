import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// 运行时读取 dbType（支持 setup 动态切换）
function getDbType(): string {
  return process.env.DB_TYPE || 'sqlite';
}

// ─── SQLite ───────────────────────────────────────────────
let sqliteDb: Database | null = null;

async function initSQLite(): Promise<Database> {
  if (sqliteDb) return sqliteDb;

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/skin_server.db');
  const dbDir = path.dirname(dbPath);

  const fs = require('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log('[DB] SQLite 连接成功:', dbPath);
  return sqliteDb;
}

// ─── PostgreSQL（懒加载）─────────────────────────────────
let pgPool: Pool | null = null;

/**
 * 获取 PostgreSQL Pool（懒加载，配置变更时自动重建）
 */
function getPgPool(): Pool {
  if (!pgPool) {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432');
    const database = process.env.DB_DATABASE || 'skin_server';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'password';

    console.log(`[DB] 创建 PostgreSQL Pool: ${user}@${host}:${port}/${database}`);
    pgPool = new Pool({
      host,
      port,
      database,
      user,
      password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pgPool;
}

/**
 * 重置 PostgreSQL Pool（配置变更后调用，关闭旧连接，下次自动重建）
 */
export async function resetPostgresPool(): Promise<void> {
  if (pgPool) {
    console.log('[DB] 关闭旧 PostgreSQL Pool');
    try {
      await pgPool.end();
    } catch (e: any) {
      console.warn('[DB] 关闭 PostgreSQL Pool 失败:', e.message);
    }
    pgPool = null;
  }
}

// ─── 数据库抽象层 ─────────────────────────────────────────
export class DB {
  /**
   * 执行查询（支持两种数据库）
   */
  static async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (getDbType() === 'sqlite') {
      return await DB.querySQLite(sql, params);
    } else {
      return await DB.queryPostgres(sql, params);
    }
  }

  /**
   * PostgreSQL 查询
   */
  private static async queryPostgres(sql: string, params: any[]): Promise<{ rows: any[] }> {
    const pool = getPgPool();
    const result = await pool.query(sql, params);
    return { rows: result.rows };
  }

  /**
   * 将 PostgreSQL $N 占位符转换为 SQLite ? 占位符
   * 处理同一参数重复使用的情况（如 $1 出现多次）
   */
  private static convertPostgresToSQLite(sql: string, params: any[]): { sql: string; params: any[] } {
    // 如果没有 $N 占位符，说明已经是 SQLite 原生格式（?）或者无参数，直接返回
    if (!/\$\d+/.test(sql)) {
      return { sql, params };
    }

    const newParams: any[] = [];
    let sqliteSql = sql.replace(/\$(\d+)/g, (_match, numStr) => {
      const index = parseInt(numStr, 10) - 1; // $1 -> index 0
      newParams.push(params[index]);
      return '?';
    });
    return { sql: sqliteSql, params: newParams };
  }

  /**
   * SQLite 查询
   */
  private static async querySQLite(sql: string, params: any[]): Promise<{ rows: any[] }> {
    const db = await initSQLite();
    
    // 转换 SQL 语法（处理 $N 占位符）
    const converted = DB.convertPostgresToSQLite(sql, params);
    let sqliteSql = converted.sql;
    const sqliteParams = converted.params;
    
    // 处理 RETURNING 子句（SQLite 不支持）
    if (sqliteSql.includes('RETURNING')) {
      return await DB.handleSQLiteReturning(sqliteSql, sqliteParams);
    }
    
    // 普通查询
    const stmt = await db.prepare(sqliteSql);
    
    if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await stmt.all(...sqliteParams);
      return { rows };
    } else if (sqliteSql.trim().toUpperCase().startsWith('INSERT')) {
      const result = await stmt.run(...sqliteParams);
      return { rows: [{ id: result.lastID }] };
    } else {
      await stmt.run(...sqliteParams);
      return { rows: [] };
    }
  }

  /**
   * 处理 SQLite 的 RETURNING 子句
   */
  private static async handleSQLiteReturning(sql: string, params: any[]): Promise<{ rows: any[] }> {
    const db = await initSQLite();

    // 提取 RETURNING 部分
    const returningMatch = sql.match(/RETURNING\s+(.+)/i);
    const returningColumns = returningMatch ? returningMatch[1] : '*';

    // 移除 RETURNING 子句
    const sqlWithoutReturning = sql.replace(/RETURNING\s+.+/, '');

    // 判断是 INSERT 还是 UPDATE
    const isInsert = /INSERT/i.test(sqlWithoutReturning);
    const isUpdate = /UPDATE/i.test(sqlWithoutReturning);

    if (isInsert) {
      const tableName = sqlWithoutReturning.match(/INSERT INTO\s+(\w+)/i)?.[1];
      if (!tableName) throw new Error('无法从 INSERT 语句中提取表名');

      const stmt = await db.prepare(sqlWithoutReturning);
      const result = await stmt.run(...params);
      const row = await db.get(`SELECT ${returningColumns} FROM ${tableName} WHERE rowid = ?`, result.lastID);
      return { rows: [row] };
    }

    if (isUpdate) {
      const tableName = sqlWithoutReturning.match(/UPDATE\s+(\w+)/i)?.[1];
      if (!tableName) throw new Error('无法从 UPDATE 语句中提取表名');

      const whereMatch = sqlWithoutReturning.match(/WHERE\s+(.+)$/i);
      if (!whereMatch) {
        const stmt = await db.prepare(sqlWithoutReturning);
        await stmt.run(...params);
        return { rows: [] };
      }

      const whereClause = whereMatch[1];

      // 计算 WHERE 子句中的占位符数量
      const beforeWhere = sqlWithoutReturning.split(/WHERE/i)[0];
      const beforeWherePlaceholders = (beforeWhere.match(/\?/g) || []).length;
      const totalPlaceholders = (sqlWithoutReturning.match(/\?/g) || []).length;
      const wherePlaceholders = totalPlaceholders - beforeWherePlaceholders;

      const whereParams = params.slice(-wherePlaceholders);

      // 执行 UPDATE
      const stmt = await db.prepare(sqlWithoutReturning);
      await stmt.run(...params);

      // 查询更新后的行
      const selectSql = `SELECT ${returningColumns} FROM ${tableName} WHERE ${whereClause}`;
      const row = await db.get(selectSql, ...whereParams);
      return { rows: [row] };
    }

    throw new Error('不支持的带 RETURNING 的 SQL 语句');
  }

  /**
   * 获取连接（用于事务）
   */
  static async getConnection(): Promise<any> {
    if (getDbType() === 'sqlite') {
      return await initSQLite();
    } else {
      const pool = getPgPool();
      return await pool.connect();
    }
  }

  /**
   * 重置 PostgreSQL 连接池（配置变更后调用，关闭旧连接，下次自动用新配置重建）
   */
  static async resetPostgresPool(): Promise<void> {
    await resetPostgresPool();
  }

  /**
   * 重置 SQLite 连接（用于 setup 重新初始化）
   */
  static async resetSQLite(): Promise<void> {
    if (getDbType() === 'sqlite' && sqliteDb) {
      try {
        await sqliteDb.close();
      } catch (e) {
        // 忽略关闭错误
      }
      sqliteDb = null;
    }
  }
}

export default DB;
