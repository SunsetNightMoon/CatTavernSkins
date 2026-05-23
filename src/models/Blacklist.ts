import DB from '../config/database';

export interface BlacklistEntry {
  id: number;
  email: string | null;
  ip_address: string | null;
  ban_type: 'permanent' | 'temporary';
  ban_until: string | null;
  reason: string | null;
  banned_by: string;
  created_at: string;
}

export interface CreateBlacklistDTO {
  email?: string;
  ip_address?: string;
  ban_type: 'permanent' | 'temporary';
  ban_until?: string | null;
  reason?: string;
  banned_by: string;
}

export class BlacklistModel {
  /**
   * 创建黑名单记录
   */
  static async create(dto: CreateBlacklistDTO): Promise<BlacklistEntry> {
    const result = await DB.query(
      `INSERT INTO blacklist (email, ip_address, ban_type, ban_until, reason, banned_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [dto.email || null, dto.ip_address || null, dto.ban_type, dto.ban_until || null, dto.reason || null, dto.banned_by]
    );
    return result.rows[0];
  }

  /**
   * 通过邮箱查找黑名单记录
   */
  static async findByEmail(email: string): Promise<BlacklistEntry | null> {
    const result = await DB.query(
      'SELECT * FROM blacklist WHERE email = $1 LIMIT 1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * 通过IP地址查找黑名单记录
   */
  static async findByIP(ipAddress: string): Promise<BlacklistEntry | null> {
    const result = await DB.query(
      'SELECT * FROM blacklist WHERE ip_address = $1 LIMIT 1',
      [ipAddress]
    );
    return result.rows[0] || null;
  }

  /**
   * 检查邮箱或IP是否在黑名单中，并返回封禁信息
   * @returns { isBlacklisted: boolean, banInfo: { type: string, until?: string, reason?: string } | null }
   */
  static async checkBlacklist(email?: string, ipAddress?: string): Promise<{
    isBlacklisted: boolean;
    banInfo: { type: string; until?: string; reason?: string } | null;
  }> {
    // 检查邮箱
    if (email) {
      const entry = await this.findByEmail(email);
      if (entry) {
        const isActive = await this.isBanActive(entry);
        if (isActive) {
          return {
            isBlacklisted: true,
            banInfo: {
              type: entry.ban_type,
              until: entry.ban_until || undefined,
              reason: entry.reason || undefined,
            },
          };
        } else {
          // 暂时封禁已过期，删除记录
          await this.delete(entry.id);
        }
      }
    }

    // 检查IP
    if (ipAddress) {
      const entry = await this.findByIP(ipAddress);
      if (entry) {
        const isActive = await this.isBanActive(entry);
        if (isActive) {
          return {
            isBlacklisted: true,
            banInfo: {
              type: entry.ban_type,
              until: entry.ban_until || undefined,
              reason: entry.reason || undefined,
            },
          };
        } else {
          // 暂时封禁已过期，删除记录
          await this.delete(entry.id);
        }
      }
    }

    return { isBlacklisted: false, banInfo: null };
  }

  /**
   * 检查封禁是否仍然有效
   */
  static async isBanActive(entry: BlacklistEntry): Promise<boolean> {
    if (entry.ban_type === 'permanent') return true;
    if (!entry.ban_until) return true; // 没有过期时间视为永久
    return new Date(entry.ban_until) > new Date();
  }

  /**
   * 通过 ID 查找黑名单记录
   */
  static async findById(id: number): Promise<BlacklistEntry | null> {
    const result = await DB.query(
      'SELECT * FROM blacklist WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 获取所有黑名单记录
   */
  static async findAll(limit: number = 100, offset: number = 0): Promise<BlacklistEntry[]> {
    const result = await DB.query(
      'SELECT * FROM blacklist ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * 删除黑名单记录
   */
  static async delete(id: number): Promise<void> {
    await DB.query('DELETE FROM blacklist WHERE id = $1', [id]);
  }

  /**
   * 通过邮箱删除黑名单记录
   */
  static async deleteByEmail(email: string): Promise<void> {
    await DB.query('DELETE FROM blacklist WHERE email = $1', [email]);
  }

  /**
   * 清理过期的暂时封禁记录
   * @returns 删除的记录数
   */
  static async cleanupExpired(): Promise<number> {
    // 先统计即将删除的记录数
    const countResult = await DB.query(
      `SELECT COUNT(*) as count FROM blacklist 
       WHERE ban_type = 'temporary' 
       AND ban_until IS NOT NULL 
       AND ban_until < CURRENT_TIMESTAMP`
    );
    const deletedCount = countResult.rows[0]?.count || 0;

    // 删除过期记录
    await DB.query(
      `DELETE FROM blacklist 
       WHERE ban_type = 'temporary' 
       AND ban_until IS NOT NULL 
       AND ban_until < CURRENT_TIMESTAMP`
    );

    return deletedCount;
  }
}
