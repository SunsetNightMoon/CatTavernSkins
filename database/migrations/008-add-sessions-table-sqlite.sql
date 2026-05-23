-- SQLite sessions 表迁移
-- 对应 Postgres 001-init-postgres.sql 中的 sessions 表定义

PRAGMA foreign_keys = OFF;

-- 创建 sessions 表
CREATE TABLE IF NOT EXISTS sessions (
    server_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    client_ip TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (access_token) REFERENCES tokens(token) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

PRAGMA foreign_keys = ON;
