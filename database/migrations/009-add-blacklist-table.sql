-- 黑名单表（支持邮箱和IP封禁，永久和暂时封禁）
CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    ip_address TEXT,
    ban_type TEXT NOT NULL DEFAULT 'permanent' CHECK (ban_type IN ('permanent', 'temporary')),
    ban_until TEXT, -- 暂时封禁的结束时间（NULL表示永久封禁）
    reason TEXT,
    banned_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (banned_by) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email);
CREATE INDEX IF NOT EXISTS idx_blacklist_ip ON blacklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_blacklist_ban_type ON blacklist(ban_type);
CREATE INDEX IF NOT EXISTS idx_blacklist_ban_until ON blacklist(ban_until);
