-- SQLite: 收藏表
-- 皮肤收藏
CREATE TABLE IF NOT EXISTS skin_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  skin_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skin_id) REFERENCES skins(id) ON DELETE CASCADE,
  UNIQUE(user_id, skin_id)
);

CREATE INDEX IF NOT EXISTS idx_skin_favorites_user_id ON skin_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_skin_favorites_skin_id ON skin_favorites(skin_id);

-- 披风收藏
CREATE TABLE IF NOT EXISTS cape_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  cape_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (cape_id) REFERENCES capes(id) ON DELETE CASCADE,
  UNIQUE(user_id, cape_id)
);

CREATE INDEX IF NOT EXISTS idx_cape_favorites_user_id ON cape_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_cape_favorites_cape_id ON cape_favorites(cape_id);
