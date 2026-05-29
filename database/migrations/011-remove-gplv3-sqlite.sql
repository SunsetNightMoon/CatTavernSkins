-- SQLite: 移除 GPLv3 协议类型
-- 由于 SQLite 不支持直接修改 CHECK 约束，需要重建表

PRAGMA foreign_keys = OFF;

-- ========== 1. 迁移 skins 表 ==========
CREATE TABLE skins_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT,
  file_path TEXT NOT NULL,
  model_type TEXT DEFAULT 'default' CHECK (model_type IN ('default', 'slim')),
  file_hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 64,
  height INTEGER NOT NULL DEFAULT 64,
  name TEXT,
  description TEXT,
  license_type TEXT DEFAULT 'ARR' CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom')),
  permission_level TEXT DEFAULT 'private' CHECK (permission_level IN ('private', 'public_no_download', 'public_downloadable')),
  is_public INTEGER DEFAULT 0,
  is_downloadable INTEGER DEFAULT 0,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TEXT,
  rejected_by TEXT,
  rejection_reason TEXT,
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id)
);

INSERT INTO skins_new SELECT * FROM skins;
DROP TABLE skins;
ALTER TABLE skins_new RENAME TO skins;

CREATE INDEX IF NOT EXISTS idx_skins_user_id ON skins(user_id);
CREATE INDEX IF NOT EXISTS idx_skins_file_hash ON skins(file_hash);
CREATE INDEX IF NOT EXISTS idx_skins_approval_status ON skins(approval_status);

-- ========== 2. 迁移 capes 表 ==========
CREATE TABLE capes_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 22,
  height INTEGER NOT NULL DEFAULT 17,
  name TEXT,
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

INSERT INTO capes_new SELECT * FROM capes;
DROP TABLE capes;
ALTER TABLE capes_new RENAME TO capes;

CREATE INDEX IF NOT EXISTS idx_capes_user_id ON capes(user_id);
CREATE INDEX IF NOT EXISTS idx_capes_file_hash ON capes(file_hash);
CREATE INDEX IF NOT EXISTS idx_capes_approval_status ON capes(approval_status);

PRAGMA foreign_keys = ON;
