-- 添加封禁截止日期字段
-- banned_until: NULL = 未封禁, 'permanent' = 永久封禁, 日期字符串 = 封禁到指定日期

-- SQLite
ALTER TABLE users ADD COLUMN banned_until TEXT DEFAULT NULL;

-- PostgreSQL
-- ALTER TABLE users ADD COLUMN banned_until TIMESTAMP DEFAULT NULL;
