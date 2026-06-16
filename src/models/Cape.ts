import DB from '../config/database';
import { generateCapeId } from '../utils/generateId';
import { FavoriteModel } from './Favorite';

export interface Cape {
  id: string;
  user_id: string;
  file_path: string;
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

export interface CreateCapeDTO {
  userId: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  width?: number;
  height?: number;
  name?: string;
  description?: string;
  licenseType?: string;
  permissionLevel?: 'private' | 'public_no_download' | 'public_downloadable';
}

export class CapeModel {
  /**
   * 创建披风记录
   */
  static async create(dto: CreateCapeDTO): Promise<Cape> {
    const id = await generateCapeId();

    const result = await DB.query(
      `INSERT INTO capes
        (id, user_id, file_path, file_hash, file_size, width, height, name, description, license_type, permission_level, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        dto.userId,
        dto.filePath,
        dto.fileHash,
        dto.fileSize,
        dto.width ?? 22,
        dto.height ?? 17,
        dto.name || null,
        dto.description || null,
        dto.licenseType ?? 'ARR',
        dto.permissionLevel ?? 'private',
        'pending',
      ]
    );

    // 同时为发布者创建收藏记录（发布者默认收藏）
    await FavoriteModel.addCapeFavorite(dto.userId, result.rows[0].id);

    return result.rows[0];
  }

  /**
   * 通过ID查找披风
   */
  static async findById(id: string): Promise<Cape | null> {
    const result = await DB.query(
      'SELECT * FROM capes WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 通过哈希查找披风（去重）
   */
  static async findByHash(fileHash: string): Promise<Cape | null> {
    const result = await DB.query(
      'SELECT * FROM capes WHERE file_hash = $1 LIMIT 1',
      [fileHash]
    );
    return result.rows[0] || null;
  }

  /**
   * 查找用户的披风列表
   */
  static async findByUserId(userId: string, includePending: boolean = true): Promise<Cape[]> {
    let sql = 'SELECT * FROM capes WHERE user_id = $1';
    if (!includePending) {
      sql += " AND approval_status = 'approved'";
    }
    sql += ' ORDER BY created_at DESC';
    const result = await DB.query(sql, [userId]);
    return result.rows;
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
      // 不能无条件置 TRUE，否则会把「私密」披风强制公开（隐私泄露）。
      await DB.query(
        `UPDATE capes
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
        `UPDATE capes
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
   * 获取披风列表（管理员用，不分状态）
   */
  static async findAllForAdmin(page: number = 1, limit: number = 20): Promise<{ capes: Cape[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await DB.query('SELECT COUNT(*) as total FROM capes');
    const total = countResult.rows[0]?.total || 0;

    const result = await DB.query(
      `SELECT c.*, u.user_uid,
              (SELECT p.name FROM profiles p WHERE p.user_id = c.user_id LIMIT 1) as uploader_name
       FROM capes c
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { capes: result.rows, total };
  }

  /**
   * 获取公开披风列表（分页，仅已审核通过的）
   */
  static async findPublic(page: number = 1, limit: number = 20): Promise<{ capes: Cape[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await DB.query(
      "SELECT COUNT(*) as total FROM capes WHERE is_public = TRUE AND approval_status = 'approved'"
    );
    const total = countResult.rows[0]?.total || 0;

    const result = await DB.query(
      `SELECT c.*, u.user_uid,
              (SELECT p.name FROM profiles p WHERE p.user_id = c.user_id LIMIT 1) as uploader_name
       FROM capes c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.is_public = TRUE AND c.approval_status = 'approved'
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { capes: result.rows, total };
  }

  /**
   * 更新披风信息（管理员用）
   */
  static async updateInfo(
    id: string,
    data: { name?: string; description?: string; license_type?: string; permission_level?: string }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.license_type !== undefined) {
      fields.push(`license_type = $${paramIndex++}`);
      values.push(data.license_type);
    }
    if (data.permission_level !== undefined) {
      fields.push(`permission_level = $${paramIndex++}`);
      values.push(data.permission_level);
      // 同步 is_public / is_downloadable
      if (data.permission_level === 'private') {
        fields.push(`is_public = $${paramIndex++}`);
        values.push(false);
        fields.push(`is_downloadable = $${paramIndex++}`);
        values.push(false);
      } else if (data.permission_level === 'public_no_download') {
        fields.push(`is_public = $${paramIndex++}`);
        values.push(true);
        fields.push(`is_downloadable = $${paramIndex++}`);
        values.push(false);
      } else if (data.permission_level === 'public_downloadable') {
        fields.push(`is_public = $${paramIndex++}`);
        values.push(true);
        fields.push(`is_downloadable = $${paramIndex++}`);
        values.push(true);
      }
    }
    if (fields.length === 0) return;

    values.push(id);
    await DB.query(
      `UPDATE capes SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  /**
   * 删除披风
   */
  static async delete(id: string): Promise<void> {
    await DB.query('DELETE FROM capes WHERE id = $1', [id]);
  }

  /**
   * 增加浏览计数
   */
  static async incrementViewCount(id: string): Promise<void> {
    await DB.query('UPDATE capes SET view_count = view_count + 1 WHERE id = $1', [id]);
  }

  /**
   * 设置 AI 生成标记（等级 1+ 管理员）
   */
  static async setAiGenerated(id: string, isAiGenerated: boolean): Promise<void> {
    await DB.query(
      'UPDATE capes SET is_ai_generated = $1 WHERE id = $2',
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
      'UPDATE capes SET admin_warning = $1, warning_set_by_level = $2 WHERE id = $3',
      [warning, adminLevel, id]
    );
  }

  /**
   * 移除管理员警告（仅等级 >= warning_set_by_level 的管理员）
   */
  static async removeAdminWarning(id: string, adminLevel: number): Promise<boolean> {
    const result = await DB.query('SELECT warning_set_by_level FROM capes WHERE id = $1', [id]);
    if (!result.rows[0] || !result.rows[0].warning_set_by_level) return true;
    const setByLevel = result.rows[0].warning_set_by_level;
    if (adminLevel < setByLevel) return false;
    await DB.query(
      'UPDATE capes SET admin_warning = NULL, warning_set_by_level = NULL WHERE id = $1',
      [id]
    );
    return true;
  }
}
