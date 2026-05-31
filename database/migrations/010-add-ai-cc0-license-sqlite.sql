-- SQLite: 添加 AI_CC0 协议类型到 license_type CHECK 约束
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

-- 显式列名拷贝（不能用 SELECT *）：源 skins 表可能由 SetupService 创建，
-- 含 original_name/views/likes 等模型未使用的“死列”，列数(26)与新表(23)不符，
-- 直接 SELECT * 会因列数不匹配而 INSERT 失败。配合迁移运行器“出错仅记录并继续”的行为，
-- 后续 DROP+RENAME 仍会执行，导致原表数据被空表覆盖丢失。显式列名按名对齐，丢弃死列且不受列顺序影响。
INSERT INTO skins_new (
  id, user_id, profile_id, file_path, model_type, file_hash, file_size,
  width, height, name, description, license_type, permission_level,
  is_public, is_downloadable, approval_status, approved_by, approved_at,
  rejected_by, rejection_reason, download_count, view_count, created_at
)
SELECT
  id, user_id, profile_id, file_path, model_type, file_hash, file_size,
  width, height, name, description, license_type, permission_level,
  is_public, is_downloadable, approval_status, approved_by, approved_at,
  rejected_by, rejection_reason, download_count, view_count, created_at
FROM skins;
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
  approved_by TEXT,
  approved_at TEXT,
  rejected_by TEXT,
  rejection_reason TEXT,
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id)
);

-- 显式列名拷贝（理由同上 skins）。capes 死列：original_name/views/likes。
INSERT INTO capes_new (
  id, user_id, file_path, file_hash, file_size, width, height, name,
  description, license_type, permission_level, is_public, is_downloadable,
  approval_status, approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at
)
SELECT
  id, user_id, file_path, file_hash, file_size, width, height, name,
  description, license_type, permission_level, is_public, is_downloadable,
  approval_status, approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at
FROM capes;
DROP TABLE capes;
ALTER TABLE capes_new RENAME TO capes;

CREATE INDEX IF NOT EXISTS idx_capes_user_id ON capes(user_id);
CREATE INDEX IF NOT EXISTS idx_capes_file_hash ON capes(file_hash);
CREATE INDEX IF NOT EXISTS idx_capes_approval_status ON capes(approval_status);

PRAGMA foreign_keys = ON;
