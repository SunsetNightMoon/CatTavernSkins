import DB from '../config/database';

export class FavoriteModel {
  /**
   * 添加皮肤收藏
   */
  static async addSkinFavorite(userId: string, skinId: string): Promise<void> {
    // 检查是否已收藏
    const existing = await DB.query(
      'SELECT 1 FROM skin_favorites WHERE user_id = $1 AND skin_id = $2 LIMIT 1',
      [userId, skinId]
    );
    if (existing.rows.length > 0) {
      throw new Error('ALREADY_FAVORITED');
    }

    await DB.query(
      'INSERT INTO skin_favorites (user_id, skin_id) VALUES ($1, $2)',
      [userId, skinId]
    );
  }

  /**
   * 移除皮肤收藏
   */
  static async removeSkinFavorite(userId: string, skinId: string): Promise<boolean> {
    const skinResult = await DB.query(
      'SELECT user_id FROM skins WHERE id = $1 LIMIT 1',
      [skinId]
    );
    if (skinResult.rows.length === 0) return false;
    const skin = skinResult.rows[0];
    if (skin.user_id === userId) {
      throw new Error('PUBLISHER_CANNOT_UNFAVORITE');
    }
    const result = await DB.query(
      'DELETE FROM skin_favorites WHERE user_id = $1 AND skin_id = $2',
      [userId, skinId]
    );
    return (result as any).changes > 0;
  }

  /**
   * 获取用户的皮肤收藏列表
   */
  static async getSkinFavorites(userId: string, page: number = 1, limit: number = 20): Promise<any[]> {
    const offset = (page - 1) * limit;
    const result = await DB.query(
      `SELECT s.*,
              (SELECT p.name FROM profiles p WHERE p.user_id = s.user_id LIMIT 1) as uploader_name,
              u.user_uid as user_uid
       FROM skin_favorites f
       JOIN skins s ON f.skin_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE f.user_id = $1 AND s.user_id != $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * 检查用户是否收藏了某个皮肤
   */
  static async isSkinFavorited(userId: string, skinId: string): Promise<boolean> {
    const result = await DB.query(
      'SELECT 1 FROM skin_favorites WHERE user_id = $1 AND skin_id = $2 LIMIT 1',
      [userId, skinId]
    );
    return result.rows.length > 0;
  }

  /**
   * 获取某皮肤的收藏数（含发布者+1）
   */
  static async getSkinFavoriteCount(skinId: string): Promise<number> {
    const result = await DB.query(
      'SELECT COUNT(*) as count FROM skin_favorites WHERE skin_id = $1',
      [skinId]
    );
    return parseInt(String(result.rows[0]?.count || '0'), 10) + 1;
  }

  /**
   * 获取用户收藏的皮肤总数（用于分页 total）
   */
  static async getSkinFavoritesCount(userId: string): Promise<number> {
    const result = await DB.query(
      `SELECT COUNT(*) as count
       FROM skin_favorites f
       JOIN skins s ON f.skin_id = s.id
       WHERE f.user_id = $1 AND s.user_id != $1`,
      [userId]
    );
    return parseInt(String(result.rows[0]?.count || '0'), 10);
  }

  /**
   * 添加披风收藏
   */
  static async addCapeFavorite(userId: string, capeId: string): Promise<void> {
    // 检查是否已收藏
    const existing = await DB.query(
      'SELECT 1 FROM cape_favorites WHERE user_id = $1 AND cape_id = $2 LIMIT 1',
      [userId, capeId]
    );
    if (existing.rows.length > 0) {
      throw new Error('ALREADY_FAVORITED');
    }

    await DB.query(
      'INSERT INTO cape_favorites (user_id, cape_id) VALUES ($1, $2)',
      [userId, capeId]
    );
  }

  /**
   * 移除披风收藏
   */
  static async removeCapeFavorite(userId: string, capeId: string): Promise<boolean> {
    const capeResult = await DB.query(
      'SELECT user_id FROM capes WHERE id = $1 LIMIT 1',
      [capeId]
    );
    if (capeResult.rows.length === 0) return false;
    const cape = capeResult.rows[0];
    if (cape.user_id === userId) {
      throw new Error('PUBLISHER_CANNOT_UNFAVORITE');
    }
    const result = await DB.query(
      'DELETE FROM cape_favorites WHERE user_id = $1 AND cape_id = $2',
      [userId, capeId]
    );
    return (result as any).changes > 0;
  }

  /**
   * 获取用户的披风收藏列表
   */
  static async getCapeFavorites(userId: string, page: number = 1, limit: number = 20): Promise<any[]> {
    const offset = (page - 1) * limit;
    const result = await DB.query(
      `SELECT c.*
       FROM cape_favorites f
       JOIN capes c ON f.cape_id = c.id
       WHERE f.user_id = $1 AND c.user_id != $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * 检查用户是否收藏了某个披风
   */
  static async isCapeFavorited(userId: string, capeId: string): Promise<boolean> {
    const result = await DB.query(
      'SELECT 1 FROM cape_favorites WHERE user_id = $1 AND cape_id = $2 LIMIT 1',
      [userId, capeId]
    );
    return result.rows.length > 0;
  }

  /**
   * 获取某披风的收藏数（含发布者+1）
   */
  static async getCapeFavoriteCount(capeId: string): Promise<number> {
    const result = await DB.query(
      'SELECT COUNT(*) as count FROM cape_favorites WHERE cape_id = $1',
      [capeId]
    );
    return parseInt(String(result.rows[0]?.count || '0'), 10) + 1;
  }

  /**
   * 获取用户收藏的披风总数（用于分页 total）
   */
  static async getCapeFavoritesCount(userId: string): Promise<number> {
    const result = await DB.query(
      `SELECT COUNT(*) as count
       FROM cape_favorites f
       JOIN capes c ON f.cape_id = c.id
       WHERE f.user_id = $1 AND c.user_id != $1`,
      [userId]
    );
    return parseInt(String(result.rows[0]?.count || '0'), 10);
  }
}
