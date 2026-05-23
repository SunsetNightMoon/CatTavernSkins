-- PostgreSQL: 收藏表

-- 皮肤收藏
CREATE TABLE IF NOT EXISTS skin_favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skin_id VARCHAR(50) NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, skin_id)
);

CREATE INDEX IF NOT EXISTS idx_skin_favorites_user_id ON skin_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_skin_favorites_skin_id ON skin_favorites(skin_id);

-- 披风收藏
CREATE TABLE IF NOT EXISTS cape_favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cape_id VARCHAR(50) NOT NULL REFERENCES capes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, cape_id)
);

CREATE INDEX IF NOT EXISTS idx_cape_favorites_user_id ON cape_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_cape_favorites_cape_id ON cape_favorites(cape_id);
