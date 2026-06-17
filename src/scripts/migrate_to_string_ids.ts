/**
 * 数据库迁移：将 skins/capes 的 ID 从 INTEGER 改为 TEXT（带前缀随机编码）。
 *
 * 该转换历史上是一个独立手动脚本，且必须在迁移 010 之前执行（010+ 假设
 * skins/capes 的主键已是 TEXT）。为消除这一“隐式手动步骤”的部署陷阱，本模块
 * 现导出 migrateToStringIds(db)，由 src/scripts/migrate.ts 在执行 010 之前
 * 自动调用。其特性：
 *   - 自守卫 / 幂等：若 skins.id 已是 TEXT（或表尚不存在）则直接跳过，无操作；
 *   - 事务化：整体在一个事务内完成，任意步骤失败即回滚，避免半迁移损坏数据。
 *
 * 仍支持手动执行：npx ts-node src/scripts/migrate_to_string_ids.ts
 */

import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

async function generateSkinId(db: Database, used: Set<string>): Promise<string> {
  let attempts = 0;
  while (attempts < 100) {
    const id = 'Skin' + randomString(20);
    if (!used.has(id)) {
      const row = await db.get('SELECT 1 FROM skins WHERE id = ? LIMIT 1', id);
      if (!row) {
        used.add(id);
        return id;
      }
    }
    attempts++;
  }
  throw new Error('无法生成唯一的皮肤ID');
}

async function generateCapeId(db: Database, used: Set<string>): Promise<string> {
  let attempts = 0;
  while (attempts < 100) {
    const id = 'Cape' + randomString(20);
    if (!used.has(id)) {
      const row = await db.get('SELECT 1 FROM capes WHERE id = ? LIMIT 1', id);
      if (!row) {
        used.add(id);
        return id;
      }
    }
    attempts++;
  }
  throw new Error('无法生成唯一的披风ID');
}

/**
 * 判断 skins.id 是否已是 TEXT。
 * 若 skins 表尚不存在，返回 true（无需迁移，视为已完成）。
 */
async function skinIdIsText(db: Database): Promise<boolean> {
  const cols: any[] = await db.all('PRAGMA table_info(skins)');
  if (!cols || cols.length === 0) return true;
  const idCol = cols.find((c: any) => c.name === 'id');
  if (!idCol) return true;
  return String(idCol.type || '').toUpperCase() === 'TEXT';
}

/**
 * 将 skins/capes 的 INTEGER 主键迁移为 TEXT（带前缀随机码），并同步更新
 * profiles.skin_id/cape_id 与 skin_favorites/cape_favorites 的外键引用。
 *
 * 自守卫 + 幂等：若已是 TEXT（或表不存在）则跳过。
 * 事务化：失败整体回滚，绝不会留下半迁移的损坏状态。
 *
 * @returns { skipped } skipped=true 表示已是 TEXT，未做任何修改。
 */
export async function migrateToStringIds(db: Database): Promise<{ skipped: boolean }> {
  if (await skinIdIsText(db)) {
    return { skipped: true };
  }

  // 外键开关必须在事务外设置（事务内 PRAGMA foreign_keys 不生效）。
  await db.exec('PRAGMA foreign_keys = OFF');
  await db.exec('BEGIN IMMEDIATE');

  try {
    const usedIds = new Set<string>();

    // ========== 1. 迁移 skins 表 ==========
    const skins = await db.all('SELECT * FROM skins ORDER BY id');

    const skinIdMap = new Map<number, string>();
    for (const skin of skins) {
      const newId = await generateSkinId(db, usedIds);
      skinIdMap.set(skin.id, newId);
    }

    await db.exec(`
      CREATE TABLE skins_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT,
        file_path TEXT NOT NULL,
        model_type TEXT DEFAULT 'default' CHECK (model_type IN ('default', 'slim')),
        file_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER NOT NULL DEFAULT 64,
        height INTEGER NOT NULL DEFAULT 64,
        description TEXT,
        license_type TEXT DEFAULT 'ARR' CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom')),
        permission_level TEXT DEFAULT 'private' CHECK (permission_level IN ('private', 'public_no_download', 'public_downloadable')),
        is_public INTEGER DEFAULT 0,
        is_downloadable INTEGER DEFAULT 0,
        is_ai_generated INTEGER DEFAULT 0,
        admin_warning TEXT DEFAULT NULL,
        warning_set_by_level INTEGER DEFAULT NULL,
        approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
        approved_by TEXT,
        approved_at TEXT,
        rejected_by TEXT,
        rejection_reason TEXT,
        download_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id),
        FOREIGN KEY (rejected_by) REFERENCES users(id)
      )
    `);

    for (const skin of skins) {
      await db.run(
        `INSERT INTO skins_new (id, user_id, profile_id, file_path, model_type, file_hash, file_size, width, height, description, license_type, permission_level, is_public, is_downloadable, is_ai_generated, admin_warning, warning_set_by_level, approval_status, approved_by, approved_at, rejected_by, rejection_reason, download_count, view_count, created_at, name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          skinIdMap.get(skin.id),
          skin.user_id,
          skin.profile_id,
          skin.file_path,
          skin.model_type,
          skin.file_hash,
          skin.file_size,
          skin.width,
          skin.height,
          skin.description,
          skin.license_type,
          skin.permission_level,
          skin.is_public,
          skin.is_downloadable,
          skin.is_ai_generated ?? 0,
          skin.admin_warning ?? null,
          skin.warning_set_by_level ?? null,
          skin.approval_status,
          skin.approved_by,
          skin.approved_at,
          skin.rejected_by,
          skin.rejection_reason,
          skin.download_count,
          skin.view_count,
          skin.created_at,
          skin.name,
        ]
      );
    }

    // ========== 2. 迁移 capes 表 ==========
    const capes = await db.all('SELECT * FROM capes ORDER BY id');

    const capeIdMap = new Map<number, string>();
    for (const cape of capes) {
      const newId = await generateCapeId(db, usedIds);
      capeIdMap.set(cape.id, newId);
    }

    await db.exec(`
      CREATE TABLE capes_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER NOT NULL DEFAULT 22,
        height INTEGER NOT NULL DEFAULT 17,
        name TEXT,
        description TEXT,
        license_type TEXT DEFAULT 'ARR',
        permission_level TEXT DEFAULT 'private',
        is_public INTEGER DEFAULT 0,
        is_downloadable INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        rejected_by TEXT,
        rejection_reason TEXT,
        download_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        is_ai_generated INTEGER DEFAULT 0,
        admin_warning TEXT DEFAULT NULL,
        warning_set_by_level INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    for (const cape of capes) {
      await db.run(
        `INSERT INTO capes_new (id, user_id, file_path, file_size, width, height, name, description, license_type, permission_level, is_public, is_downloadable, approval_status, approved_by, approved_at, rejected_by, rejection_reason, download_count, view_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          capeIdMap.get(cape.id),
          cape.user_id,
          cape.file_path,
          cape.file_size,
          cape.width,
          cape.height,
          cape.name,
          cape.description,
          cape.license_type,
          cape.permission_level,
          cape.is_public,
          cape.is_downloadable,
          cape.approval_status,
          cape.approved_by,
          cape.approved_at,
          cape.rejected_by,
          cape.rejection_reason,
          cape.download_count,
          cape.view_count,
          cape.created_at,
        ]
      );
    }

    // ========== 3. 更新 profiles 表的外键 ==========
    await db.exec(`
      CREATE TABLE profiles_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        name_changed_at TEXT,
        skin_id TEXT,
        cape_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const profiles = await db.all('SELECT * FROM profiles');
    for (const profile of profiles) {
      await db.run(
        `INSERT INTO profiles_new (id, user_id, name, created_at, name_changed_at, skin_id, cape_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          profile.id,
          profile.user_id,
          profile.name,
          profile.created_at,
          profile.name_changed_at,
          profile.skin_id ? skinIdMap.get(profile.skin_id) || null : null,
          profile.cape_id ? capeIdMap.get(profile.cape_id) || null : null,
        ]
      );
    }

    // ========== 4. 更新 skin_favorites 表 ==========
    await db.exec(`
      CREATE TABLE skin_favorites_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        skin_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (skin_id) REFERENCES skins_new(id) ON DELETE CASCADE,
        UNIQUE(user_id, skin_id)
      )
    `);

    const skinFavs = await db.all('SELECT * FROM skin_favorites');
    for (const fav of skinFavs) {
      const newSkinId = skinIdMap.get(fav.skin_id);
      if (newSkinId) {
        await db.run(
          `INSERT INTO skin_favorites_new (user_id, skin_id, created_at) VALUES (?, ?, ?)`,
          [fav.user_id, newSkinId, fav.created_at]
        );
      }
    }

    // ========== 5. 更新 cape_favorites 表 ==========
    await db.exec(`
      CREATE TABLE cape_favorites_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        cape_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (cape_id) REFERENCES capes_new(id) ON DELETE CASCADE,
        UNIQUE(user_id, cape_id)
      )
    `);

    const capeFavs = await db.all('SELECT * FROM cape_favorites');
    for (const fav of capeFavs) {
      const newCapeId = capeIdMap.get(fav.cape_id);
      if (newCapeId) {
        await db.run(
          `INSERT INTO cape_favorites_new (user_id, cape_id, created_at) VALUES (?, ?, ?)`,
          [fav.user_id, newCapeId, fav.created_at]
        );
      }
    }

    // ========== 6. 删除旧表，重命名新表 ==========
    await db.exec('DROP TABLE skin_favorites');
    await db.exec('ALTER TABLE skin_favorites_new RENAME TO skin_favorites');

    await db.exec('DROP TABLE cape_favorites');
    await db.exec('ALTER TABLE cape_favorites_new RENAME TO cape_favorites');

    await db.exec('DROP TABLE profiles');
    await db.exec('ALTER TABLE profiles_new RENAME TO profiles');

    await db.exec('DROP TABLE skins');
    await db.exec('ALTER TABLE skins_new RENAME TO skins');

    await db.exec('DROP TABLE capes');
    await db.exec('ALTER TABLE capes_new RENAME TO capes');

    // 更新 sqlite_sequence（旧的 AUTOINCREMENT 计数已无意义）
    await db.run("DELETE FROM sqlite_sequence WHERE name = 'skins'").catch(() => {});
    await db.run("DELETE FROM sqlite_sequence WHERE name = 'capes'").catch(() => {});

    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }

  return { skipped: false };
}

/**
 * CLI 入口：仅在直接运行本文件时执行（被 import 时不触发）。
 */
async function runCli(): Promise<void> {
  const dbPath = path.join(__dirname, '../../data/skin_server.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  console.log('连接到数据库:', dbPath);
  try {
    const result = await migrateToStringIds(db);
    if (result.skipped) {
      console.log('skins.id 已是 TEXT，无需迁移（跳过）');
    } else {
      console.log('\n✅ 迁移完成！INTEGER 主键已转换为 TEXT');
    }
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error('迁移失败:', err);
    process.exit(1);
  });
}
