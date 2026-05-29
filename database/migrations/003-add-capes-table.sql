-- 003-add-capes-table.sql
-- 披风表

-- 披风表
CREATE TABLE IF NOT EXISTS capes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL DEFAULT 22,
    height INTEGER NOT NULL DEFAULT 17,
    description TEXT,
    license_type TEXT DEFAULT 'ARR' CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom')),
    permission_level TEXT DEFAULT 'private' CHECK (permission_level IN ('private', 'public_no_download', 'public_downloadable')),
    is_public INTEGER DEFAULT 0,
    is_downloadable INTEGER DEFAULT 0,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capes_user_id ON capes(user_id);
CREATE INDEX IF NOT EXISTS idx_capes_approval_status ON capes(approval_status);
