-- 迁移：添加令牌表新列
-- 用于支持新的令牌结构

-- 添加 access_token 列（忽略已存在的错误）
ALTER TABLE tokens ADD COLUMN access_token TEXT UNIQUE;

-- 添加 client_token 列  
ALTER TABLE tokens ADD COLUMN client_token TEXT;

-- 添加 last_used_at 列
ALTER TABLE tokens ADD COLUMN last_used_at TEXT;

-- 如果 access_token 为空，用 token 列填充
UPDATE tokens SET access_token = token WHERE access_token IS NULL;
