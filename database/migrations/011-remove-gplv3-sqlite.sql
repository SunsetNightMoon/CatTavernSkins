-- SQLite: 移除 GPLv3 协议类型
-- 安全版本：在 DROP TABLE 之前验证数据已正确迁移

PRAGMA foreign_keys = OFF;

-- ========== 1. 迁移 skins 表 ==========
CREATE TABLE IF NOT EXISTS skins_new (
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
  is_ai_generated INTEGER DEFAULT 0,
  admin_warning TEXT DEFAULT NULL,
  warning_set_by_level INTEGER DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id)
);

INSERT OR IGNORE INTO skins_new (
  id, user_id, profile_id, file_path, model_type, file_hash, file_size,
  width, height, name, description,
  license_type,
  permission_level, is_public, is_downloadable, approval_status,
  approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at,
  is_ai_generated, admin_warning, warning_set_by_level
) SELECT
  id, user_id, profile_id, file_path, model_type, file_hash, file_size,
  width, height, name, description,
  CASE WHEN license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom') THEN license_type ELSE 'ARR' END,
  permission_level, is_public, is_downloadable, approval_status,
  approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at,
  COALESCE(is_ai_generated, 0), admin_warning, warning_set_by_level
FROM skins
WHERE EXISTS (SELECT 1 FROM skins)
  AND NOT EXISTS (SELECT 1 FROM skins_new WHERE skins_new.id = skins.id);

-- ========== 2. 迁移 capes 表 ==========
CREATE TABLE IF NOT EXISTS capes_new (
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
  is_ai_generated INTEGER DEFAULT 0,
  admin_warning TEXT DEFAULT NULL,
  warning_set_by_level INTEGER DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id)
);

INSERT OR IGNORE INTO capes_new (
  id, user_id, file_path, file_hash, file_size,
  width, height, name, description,
  license_type,
  permission_level, is_public, is_downloadable, approval_status,
  approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at,
  is_ai_generated, admin_warning, warning_set_by_level
) SELECT
  id, user_id, file_path, file_hash, file_size,
  width, height, name, description,
  CASE WHEN license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom') THEN license_type ELSE 'ARR' END,
  permission_level, is_public, is_downloadable, approval_status,
  approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at,
  COALESCE(is_ai_generated, 0), admin_warning, warning_set_by_level
FROM capes
WHERE EXISTS (SELECT 1 FROM capes)
  AND NOT EXISTS (SELECT 1 FROM capes_new WHERE capes_new.id = capes.id);

PRAGMA foreign_keys = ON;
