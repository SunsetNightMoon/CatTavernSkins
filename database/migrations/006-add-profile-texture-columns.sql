-- SQLite: 给 profiles 表添加皮肤/披风关联字段和改名时间字段

ALTER TABLE profiles ADD COLUMN skin_id INTEGER;
ALTER TABLE profiles ADD COLUMN cape_id INTEGER;
ALTER TABLE profiles ADD COLUMN name_changed_at TEXT;

-- 创建外键索引（SQLite 3.6.19+ 支持外键，但 ALTER TABLE 不能直接加外键约束）
-- 这里用索引替代，外键约束在应用层保证
CREATE INDEX IF NOT EXISTS idx_profiles_skin_id ON profiles(skin_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cape_id ON profiles(cape_id);
