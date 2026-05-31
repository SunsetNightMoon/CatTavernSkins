import request from 'supertest';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Express } from 'express';

let app: Express;
let db: Database;

const originalEnv = process.env;

process.env = {
  ...originalEnv,
  ALLOW_REGISTRATION: 'true',
  ENABLE_CAPTCHA: 'false',
  NODE_ENV: 'test',
  DB_TYPE: 'sqlite',
  JWT_SECRET: 'test-jwt-secret',
  UPLOAD_DIR: './test-uploads',
};

jest.mock('../../../src/config/database', () => {
  class MockDB {
    static async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
      if (!db) throw new Error('Database not initialized');
      const converted = MockDB.convertPostgresToSQLite(sql, params);
      let sqliteSql = converted.sql;
      const sqliteParams = converted.params;

      if (sqliteSql.includes('RETURNING')) {
        return MockDB.handleSQLiteReturning(sqliteSql, sqliteParams);
      }

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

    private static convertPostgresToSQLite(sql: string, params: any[]): { sql: string; params: any[] } {
      if (!/\$\d+/.test(sql)) {
        return { sql, params };
      }
      const newParams: any[] = [];
      const sqliteSql = sql.replace(/\$(\d+)/g, (_match: string, numStr: string) => {
        const index = parseInt(numStr, 10) - 1;
        newParams.push(params[index]);
        return '?';
      });
      return { sql: sqliteSql, params: newParams };
    }

    private static async handleSQLiteReturning(sql: string, params: any[]): Promise<{ rows: any[] }> {
      if (!db) throw new Error('Database not initialized');
      const returningMatch = sql.match(/RETURNING\s+(.+)/i);
      const returningColumns = returningMatch ? returningMatch[1] : '*';
      const sqlWithoutReturning = sql.replace(/RETURNING\s+.+/, '');

      const isInsert = /INSERT/i.test(sqlWithoutReturning);
      const isUpdate = /UPDATE/i.test(sqlWithoutReturning);

      if (isInsert) {
        const tableName = sqlWithoutReturning.match(/INSERT INTO\s+(\w+)/i)?.[1];
        if (!tableName) throw new Error('Cannot extract table name');
        const stmt = await db.prepare(sqlWithoutReturning);
        const result = await stmt.run(...params);
        const row = await db.get(`SELECT ${returningColumns} FROM ${tableName} WHERE rowid = ?`, result.lastID);
        return { rows: [row] };
      }

      if (isUpdate) {
        const tableName = sqlWithoutReturning.match(/UPDATE\s+(\w+)/i)?.[1];
        if (!tableName) throw new Error('Cannot extract table name');
        const whereMatch = sqlWithoutReturning.match(/WHERE\s+(.+)$/i);
        if (!whereMatch) {
          const stmt = await db.prepare(sqlWithoutReturning);
          await stmt.run(...params);
          return { rows: [] };
        }
        const whereClause = whereMatch[1];
        const beforeWhere = sqlWithoutReturning.split(/WHERE/i)[0];
        const beforeWherePlaceholders = (beforeWhere.match(/\?/g) || []).length;
        const totalPlaceholders = (sqlWithoutReturning.match(/\?/g) || []).length;
        const wherePlaceholders = totalPlaceholders - beforeWherePlaceholders;
        const whereParams = params.slice(-wherePlaceholders);
        const stmt = await db.prepare(sqlWithoutReturning);
        await stmt.run(...params);
        const selectSql = `SELECT ${returningColumns} FROM ${tableName} WHERE ${whereClause}`;
        const row = await db.get(selectSql, ...whereParams);
        return { rows: [row] };
      }

      throw new Error('Unsupported RETURNING SQL');
    }

    static async getConnection() {
      return db;
    }

    static async resetPostgresPool() {}
    static async resetSQLite() {}
  }

  return { __esModule: true, DB: MockDB, default: MockDB };
});

async function initDb(): Promise<Database> {
  const database = await open({
    filename: ':memory:',
    driver: sqlite3.Database,
  });

  await database.run('PRAGMA foreign_keys = ON');

  await database.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    user_uid INTEGER UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    level INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    banned_until TEXT,
    verification_token TEXT,
    verification_expires TEXT,
    last_login_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT UNIQUE NOT NULL,
    is_default INTEGER DEFAULT 0,
    skin_id TEXT,
    cape_id TEXT,
    name_changed_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS skins (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    original_name TEXT,
    model_type TEXT DEFAULT 'default',
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    name TEXT,
    description TEXT,
    license_type TEXT DEFAULT 'default',
    permission_level TEXT DEFAULT 'private',
    is_public INTEGER DEFAULT 0,
    is_downloadable INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    approval_status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    rejected_by TEXT,
    rejection_reason TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS capes (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    original_name TEXT,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    name TEXT,
    description TEXT,
    license_type TEXT DEFAULT 'default',
    permission_level TEXT DEFAULT 'private',
    is_public INTEGER DEFAULT 0,
    is_downloadable INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    approval_status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    rejected_by TEXT,
    rejection_reason TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    client_token TEXT,
    user_id TEXT NOT NULL,
    profile_id TEXT,
    expires_at TEXT,
    token_type TEXT DEFAULT 'access',
    last_used_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    ip_address TEXT,
    ban_type TEXT DEFAULT 'temporary',
    ban_until TEXT,
    reason TEXT,
    banned_by TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(provider, provider_account_id)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS skin_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skin_id TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, skin_id)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS cape_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    cape_id TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, cape_id)
  )`);

  await database.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    expires_at TEXT
  )`);

  await database.run("INSERT OR IGNORE INTO system_config (key, value) VALUES ('setup_completed', 'true')");

  return database;
}

describe('Skins API Integration', () => {
  beforeAll(async () => {
    db = await initDb();
    const appModule = await import('../../../src/app');
    app = appModule.default;
  });

  beforeEach(async () => {
    const tables = ['cape_favorites', 'skin_favorites', 'sessions', 'tokens',
      'blacklist', 'oauth_accounts', 'capes', 'skins', 'profiles', 'users'];
    for (const table of tables) {
      await db.run(`DELETE FROM ${table}`).catch(() => {});
    }
    await db.run("INSERT OR IGNORE INTO system_config (key, value) VALUES ('setup_completed', 'true')");
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await db.close().catch(() => {});
    process.env = originalEnv;
  });

  it('GET /api/skins should return 401 without auth', async () => {
    const res = await request(app)
      .get('/api/skins');

    expect(res.status).toBe(401);
  });

  it('GET /api/skins should return empty array with valid token', async () => {
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');
    const passwordHash = await bcrypt.hash('testpassword', 10);
    const userId = uuidv4();
    await db.run(
      "INSERT INTO users (id, user_uid, email, password_hash, role, level, is_active, email_verified) VALUES (?, ?, ?, ?, 'user', 0, 1, 1)",
      [userId, 1, 'skins@test.com', passwordHash]
    );

    const profileId = uuidv4();
    await db.run(
      "INSERT INTO profiles (id, user_id, name) VALUES (?, ?, ?)",
      [profileId, userId, 'SkinUser']
    );

    const accessToken = 'test-skins-access-token';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15);
    await db.run(
      "INSERT INTO tokens (token, access_token, client_token, user_id, profile_id, expires_at, token_type) VALUES (?, ?, ?, ?, ?, ?, 'access')",
      [accessToken, accessToken, 'test-client', userId, profileId, expiresAt.toISOString()]
    );

    const res = await request(app)
      .get('/api/skins')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/skins/:id should return 404 for non-existent skin', async () => {
    const res = await request(app)
      .get('/api/skins/non-existent-id');

    expect(res.status).toBe(404);
  });
});
