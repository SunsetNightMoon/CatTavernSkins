-- PostgreSQL: 为 skins 和 capes 表添加 AI 识别和管理员警告字段
-- 迁移版本: 012-add-ai-warning-fields-postgres.sql

-- skins 表
ALTER TABLE skins ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE skins ADD COLUMN IF NOT EXISTS admin_warning TEXT DEFAULT NULL;
ALTER TABLE skins ADD COLUMN IF NOT EXISTS warning_set_by_level INTEGER DEFAULT NULL;

-- capes 表
ALTER TABLE capes ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE capes ADD COLUMN IF NOT EXISTS admin_warning TEXT DEFAULT NULL;
ALTER TABLE capes ADD COLUMN IF NOT EXISTS warning_set_by_level INTEGER DEFAULT NULL;
