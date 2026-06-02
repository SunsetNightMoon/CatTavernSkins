-- SQLite: 添加 AI_CC0 协议类型到 license_type CHECK 约束
-- 安全版本：在 DROP TABLE 之前验证数据已正确迁移

PRAGMA foreign_keys = OFF;

-- ========== 1. 迁移 skins 表 ==========
-- 只有在 skins_new 不存在时才创建
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

-- 只有在 skins 表存在且 skins_new 为空时才迁移数据
-- 使用 INSERT OR IGNORE 避免重复插入
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
  COALESCE(license_type, 'ARR'),
  permission_level, is_public, is_downloadable, approval_status,
  approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at,
  COALESCE(is_ai_generated, 0), admin_warning, warning_set_by_level
FROM skins
WHERE EXISTS (SELECT 1 FROM skins)
  AND NOT EXISTS (SELECT 1 FROM skins_new WHERE skins_new.id = skins.id);

-- 验证：只有当 skins_new 有数据（或 skins 本来就是空的）才替换
-- 如果 skins 表不存在（第一次运行），直接重命名
-- 如果 skins 表存在，确保 skins_new 行数 = skins 行数才替换
-- SQLite 不支持 IF 语句，所以用两种方式：
-- 1. 如果 skins 表不存在，直接重命名 skins_new
-- 2. 如果 skins 表存在，手动验证后执行（这里用 Python 脚本更安全）
-- 为简化，这里用 DROP + RENAME，但前提是上面的 INSERT 必须成功

-- 检查 skins 表是否存在
SELECT CASE 
  WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='skins')
  THEN 'EXISTS'
  ELSE 'NOT_EXISTS'
END AS skins_exists;

-- 由于 SQLite 脚本不支持条件分支，我们改为：
-- 如果 skins_new 不为空 或 skins 不存在，则完成迁移
-- 实际上，上面的 INSERT OR IGNORE 已经保证了幂等性

-- 手动执行以下命令（通过应用层逻辑确保安全性）：
-- 1. 如果 skins 表存在，且 skins_new 行数 < skins 行数，则回滚（不执行 DROP）
-- 2. 否则，执行 DROP + RENAME

-- 为简化，这里用应用层（migrate.ts）来处理条件逻辑
-- SQL 文件只负责：创建 skins_new + 插入数据
-- DROP + RENAME 由应用层在验证数据完整性后执行

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
  COALESCE(license_type, 'ARR'),
  permission_level, is_public, is_downloadable, approval_status,
  approved_by, approved_at, rejected_by, rejection_reason,
  download_count, view_count, created_at,
  COALESCE(is_ai_generated, 0), admin_warning, warning_set_by_level
FROM capes
WHERE EXISTS (SELECT 1 FROM capes)
  AND NOT EXISTS (SELECT 1 FROM capes_new WHERE capes_new.id = capes.id);

PRAGMA foreign_keys = ON;
