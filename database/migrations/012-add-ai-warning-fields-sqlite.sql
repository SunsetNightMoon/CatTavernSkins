-- SQLite: 为 skins 和 capes 表添加 AI 识别和管理员警告字段
-- 迁移版本: 012-add-ai-warning-fields-sqlite.sql

-- skins 表
ALTER TABLE skins ADD COLUMN is_ai_generated INTEGER DEFAULT 0;
ALTER TABLE skins ADD COLUMN admin_warning TEXT DEFAULT NULL;
ALTER TABLE skins ADD COLUMN warning_set_by_level INTEGER DEFAULT NULL;

-- capes 表
ALTER TABLE capes ADD COLUMN is_ai_generated INTEGER DEFAULT 0;
ALTER TABLE capes ADD COLUMN admin_warning TEXT DEFAULT NULL;
ALTER TABLE capes ADD COLUMN warning_set_by_level INTEGER DEFAULT NULL;
