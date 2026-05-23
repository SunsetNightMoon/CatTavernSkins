-- 添加 name 字段到 skins 和 capes 表
-- SQLite 语法（供 Web 前端独立披风表使用）

-- skins 表添加 name
ALTER TABLE skins ADD COLUMN name TEXT;

-- capes 表添加 name
ALTER TABLE capes ADD COLUMN name TEXT;
