import DB from '../config/database';
import { generateUUID, generateOfflineUUID } from '../utils/uuid';
import { Property } from '../types/yggdrasil';

export interface Profile {
  id: string;
  name: string;
  user_id: string;
  skin_id?: string;
  cape_id?: string;
  created_at: Date;
  name_changed_at?: string | null;
  properties?: Property[];
}

export interface CreateProfileDTO {
  name: string;
  userId: string;
  useOfflineUUID?: boolean;
}

export class ProfileModel {
  /**
   * 创建角色
   */
  static async create(dto: CreateProfileDTO): Promise<Profile> {
    const id = dto.useOfflineUUID 
      ? generateOfflineUUID(dto.name) 
      : generateUUID();

    const result = await DB.query(
      'INSERT INTO profiles (id, name, user_id) VALUES ($1, $2, $3) RETURNING *',
      [id, dto.name, dto.userId]
    );

    return result.rows[0] || {
      id,
      name: dto.name,
      user_id: dto.userId,
      created_at: new Date(),
    };
  }

  /**
   * 通过UUID查找角色
   */
  static async findById(id: string): Promise<Profile | null> {
    const result = await DB.query(
      'SELECT * FROM profiles WHERE id = $1 LIMIT 1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * 通过名称查找角色
   */
  static async findByName(name: string): Promise<Profile | null> {
    const result = await DB.query(
      'SELECT * FROM profiles WHERE name = $1 LIMIT 1',
      [name]
    );

    return result.rows[0] || null;
  }

  /**
   * 查找用户的角色列表
   */
  static async findByUserId(userId: string): Promise<Profile[]> {
    const result = await DB.query(
      'SELECT * FROM profiles WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    return result.rows;
  }

  /**
   * 更新角色皮肤
   */
  static async updateSkin(profileId: string, skinId: string | null): Promise<void> {
    await DB.query(
      'UPDATE profiles SET skin_id = $1 WHERE id = $2',
      [skinId, profileId]
    );
  }

  /**
   * 更新角色披风
   */
  static async updateCape(profileId: string, capeId: string | null): Promise<void> {
    await DB.query(
      'UPDATE profiles SET cape_id = $1 WHERE id = $2',
      [capeId, profileId]
    );
  }

  /**
   * 更新角色名称
   */
  static async updateName(profileId: string, newName: string): Promise<Profile> {
    const today = new Date().toISOString();
    const result = await DB.query(
      'UPDATE profiles SET name = $1, name_changed_at = $2 WHERE id = $3 RETURNING *',
      [newName, today, profileId]
    );
    return result.rows[0];
  }

  /**
   * 检查角色名称是否被使用
   */
  static async isNameTaken(name: string, excludeProfileId?: string): Promise<boolean> {
    if (excludeProfileId) {
      const result = await DB.query(
        'SELECT id FROM profiles WHERE name = $1 AND id != $2 LIMIT 1',
        [name, excludeProfileId]
      );
      return result.rows.length > 0;
    }
    const existing = await this.findByName(name);
    return existing !== null;
  }

  /**
   * 删除角色
   */
  static async delete(id: string): Promise<void> {
    await DB.query(
      'DELETE FROM profiles WHERE id = $1',
      [id]
    );
  }

  /**
   * 批量查找角色（通过名称）
   */
  static async findBatchByNames(names: string[]): Promise<Profile[]> {
    if (names.length === 0) return [];

    const placeholders = names.map((_, i) => `$${i + 1}`).join(',');
    const result = await DB.query(
      `SELECT * FROM profiles WHERE name IN (${placeholders}) LIMIT $${names.length + 1}`,
      [...names, names.length]
    );

    return result.rows;
  }

  /**
   * 批量查找角色（通过UUID）
   */
  static async findBatchByIds(ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await DB.query(
      `SELECT * FROM profiles WHERE id IN (${placeholders}) LIMIT $${ids.length + 1}`,
      [...ids, ids.length]
    );

    return result.rows;
  }
}
