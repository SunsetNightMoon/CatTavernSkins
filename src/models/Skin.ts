import DB from '../config/database';
import { generateSkinId } from '../utils/generateId';
import { FavoriteModel } from './Favorite';

export interface Skin {
  id: string;
  user_id: string;
  profile_id?: string;
  file_path: string;
  model_type: 'default' | 'slim';
  file_hash: string;
  file_size: number;
  width: number;
  height: number;
  name?: string;
  description?: string;
  license_type: string;
  permission_level: 'private' | 'public_no_download' | 'public_downloadable';
  is_public: boolean;
  is_downloadable: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: Date;
  rejected_by?: string;
  rejection_reason?: string;
  download_count: number;
  view_count: number;
  created_at: Date;
  is_ai_generated?: boolean;
  admin_warning?: string | null;
  warning_set_by_level?: number | null;
}

export interface CreateSkinDTO {
  userId: string;
  profileId?: string;
  filePath: string;
  modelType: 'default' | 'slim';
  fileHash: string;
  fileSize: number;
  width: number;
  height: number;
  name?: string;
  description?: string;
  licenseType: string;
  permissionLevel: 'private' | 'public_no_download' | 'public_downloadable';
}

export class SkinModel {
  /**
   * 创建皮肤记录
   */
  static async create(dto: CreateSkinDTO): Promise<Skin> {
    const id = await generateSkinId();

    const result = await DB.query(
      `INSERT INTO skins
        (id, user_id, profile_id, file_path, model_type, file_hash, file_size, width, height, name, description, license_type, permission_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        dto.userId,
        dto.profileId || null,
        dto.filePath,
        dto.modelType,
        dto.fileHash,
        dto.fileSize,
        dto.width,
        dto.height,
        dto.name || null,
        dto.description || null,
        dto.licenseType,
        dto.permissionLevel,
      ]
    );

    // 同时自动为发布者创建收藏记录（发布者默认收藏）
    await FavoriteModel.addSkinFavorite(dto.userId, result.rows[0].id);

    return result.rows[0];
  }

  /**
   * 通过ID查找皮肤
   */
  static async findById(id: string): Promise<Skin | null> {
    const result = await DB.query(
      'SELECT * FROM skins WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 通过哈希查找皮肤（去重）
   */
  static async findByHash(fileHash: string): Promise<Skin | null> {
    const result = await DB.query(
      'SELECT * FROM skins WHERE file_hash = $1 LIMIT 1',
      [fileHash]
    );

    return result.rows[0] || null;
  }

  /**
   * 查找用户的皮肤列表
   */
  static async findByUserId(userId: string, page: number = 1, limit: number = 20): Promise<Skin[]> {
    const offset = (page - 1) * limit;

    const result = await DB.query(
      'SELECT * FROM skins WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * 查找角色的激活皮肤
   */
  static async findActiveSkinByProfileId(profileId: string): Promise<Skin | null> {
    const result = await DB.query(
      `SELECT s.* FROM skins s
       JOIN profiles p ON s.id = p.skin_id
       WHERE p.id = $1 LIMIT 1`,
      [profileId]
    );

    return result.rows[0] || null;
  }

  /**
   * 更新皮肤关联的角色
   */
  static async updateProfileId(skinId: string, profileId: string): Promise<void> {
    await DB.query(
      'UPDATE skins SET profile_id = $1 WHERE id = $2',
      [profileId, skinId]
    );
  }

  /**
   * 删除皮肤
   */
  static async delete(id: string): Promise<void> {
    await DB.query(
      'DELETE FROM skins WHERE id = $1',
      [id]
    );
  }

  /**
   * 更新审核状态
   */
  static async updateApprovalStatus(
    id: string,
    status: 'approved' | 'rejected',
    approvedBy: string,
    rejectionReason?: string
  ): Promise<void> {
    if (status === 'approved') {
      // 审核通过：is_public/is_downloadable 必须遵从所有者设置的 permission_level，
      // 不能无条件置 TRUE，否则会把「私密」皮肤强制公开（隐私泄露）。
      await DB.query(
        `UPDATE skins
         SET approval_status = $1,
             is_public = CASE WHEN permission_level = 'private' THEN FALSE ELSE TRUE END,
             is_downloadable = CASE WHEN permission_level = 'public_downloadable' THEN TRUE ELSE FALSE END,
             approved_by = $2,
             approved_at = CURRENT_TIMESTAMP,
             rejected_by = NULL,
             rejection_reason = NULL
         WHERE id = $3`,
        [status, approvedBy, id]
      );
    } else {
      await DB.query(
        `UPDATE skins
         SET approval_status = $1,
             is_public = FALSE,
             rejected_by = $2,
             rejection_reason = $3,
             approved_by = NULL,
             approved_at = NULL
         WHERE id = $4`,
        [status, approvedBy, rejectionReason || null, id]
      );
    }
  }

  /**
   * 更新权限级别
   */
  static async updatePermissionLevel(
    id: string,
    permissionLevel: 'private' | 'public_no_download' | 'public_downloadable',
    isPublic: boolean,
    isDownloadable: boolean
  ): Promise<void> {
    await DB.query(
      `UPDATE skins
       SET permission_level = $1,
           is_public = $2,
           is_downloadable = $3
       WHERE id = $4`,
      [permissionLevel, isPublic, isDownloadable, id]
    );
  }

  /**
   * 增加下载计数
   */
  static async incrementDownloadCount(id: string): Promise<void> {
    await DB.query(
      'UPDATE skins SET download_count = download_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * 分页查询所有皮肤（管理员用）
   */
  static async findAll(page: number = 1, limit: number = 20): Promise<Skin[]> {
    const offset = (page - 1) * limit;
    const result = await DB.query(
      `SELECT s.*,
              (SELECT p.name FROM profiles p WHERE p.user_id = s.user_id LIMIT 1) as uploader_name,
              u.user_uid as user_uid
       FROM skins s
       LEFT JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * 获取皮肤总数（管理员用）
   */
  static async countAll(): Promise<number> {
    const result = await DB.query('SELECT COUNT(*) as count FROM skins');
    return result.rows[0].count;
  }

  /**
   * 更新皮肤信息（名称、描述、协议、权限级别）
   */
  static async updateInfo(
    id: string,
    data: {
      name?: string;
      description?: string;
      license_type?: string;
      permission_level?: 'private' | 'public_no_download' | 'public_downloadable';
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.license_type !== undefined) { fields.push(`license_type = $${idx++}`); values.push(data.license_type); }
    if (data.permission_level !== undefined) {
      fields.push(`permission_level = $${idx++}`);
      values.push(data.permission_level);
      // 同步 is_public / is_downloadable
      const isPublic = data.permission_level !== 'private';
      const isDownloadable = data.permission_level === 'public_downloadable';
      fields.push(`is_public = $${idx++}`); values.push(isPublic);
      fields.push(`is_downloadable = $${idx++}`); values.push(isDownloadable);
    }

    if (fields.length === 0) return;

    values.push(id);
    await DB.query(
      `UPDATE skins SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
  }

  /**
   * 增加浏览计数
   */
  static async incrementViewCount(id: string): Promise<void> {
    await DB.query(
      'UPDATE skins SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * 设置 AI 生成标记（等级 1+ 管理员）
   */
  static async setAiGenerated(id: string, isAiGenerated: boolean): Promise<void> {
    await DB.query(
      'UPDATE skins SET is_ai_generated = $1 WHERE id = $2',
      [isAiGenerated, id]
    );
  }

  /**
   * 设置管理员警告（仅等级 2 超级管理员）
   * 设置后等级 1 管理员无法移除
   */
  static async setAdminWarning(id: string, warning: string, adminLevel: number): Promise<void> {
    if (adminLevel < 2) throw new Error('需要超级管理员权限');
    await DB.query(
      'UPDATE skins SET admin_warning = $1, warning_set_by_level = $2 WHERE id = $3',
      [warning, adminLevel, id]
    );
  }

  /**
   * 移除管理员警告（仅等级 >= warning_set_by_level 的管理员）
   */
  static async removeAdminWarning(id: string, adminLevel: number): Promise<boolean> {
    const result = await DB.query('SELECT warning_set_by_level FROM skins WHERE id = $1', [id]);
    if (!result.rows[0] || !result.rows[0].warning_set_by_level) return true;
    const setByLevel = result.rows[0].warning_set_by_level;
    if (adminLevel < setByLevel) return false;
    await DB.query(
      'UPDATE skins SET admin_warning = NULL, warning_set_by_level = NULL WHERE id = $1',
      [id]
    );
    return true;
  }
}
