import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let testDb: Database | null = null;

const TABLE_DEFINITIONS = [
  `CREATE TABLE IF NOT EXISTS users (
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
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT UNIQUE NOT NULL,
    is_default INTEGER DEFAULT 0,
    skin_id TEXT,
    cape_id TEXT,
    name_changed_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS skins (
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
    is_ai_generated INTEGER DEFAULT 0,
    admin_warning TEXT,
    warning_set_by_level INTEGER,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS capes (
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
    is_ai_generated INTEGER DEFAULT 0,
    admin_warning TEXT,
    warning_set_by_level INTEGER,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS tokens (
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
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    expires_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    ip_address TEXT,
    ban_type TEXT DEFAULT 'temporary',
    ban_until TEXT,
    reason TEXT,
    banned_by TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'microsoft')),
    provider_account_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS skin_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skin_id TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, skin_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cape_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    cape_id TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, cape_id)
  )`,
];

const TABLE_NAMES = [
  'cape_favorites', 'skin_favorites', 'sessions', 'tokens',
  'blacklist', 'oauth_accounts', 'capes', 'skins', 'profiles',
  'users', 'system_config',
];

export async function setupTestDb(): Promise<Database> {
  testDb = await open({
    filename: ':memory:',
    driver: sqlite3.Database,
  });

  await testDb.run('PRAGMA foreign_keys = ON');

  for (const ddl of TABLE_DEFINITIONS) {
    await testDb.run(ddl);
  }

  return testDb;
}

export async function cleanupTestDb(): Promise<void> {
  if (!testDb) return;

  for (const table of TABLE_NAMES) {
    await testDb.run(`DELETE FROM ${table}`).catch(() => {});
  }
}

export async function closeTestDb(): Promise<void> {
  if (!testDb) return;
  await testDb.close();
  testDb = null;
}

export function getTestDb(): Database | null {
  return testDb;
}
