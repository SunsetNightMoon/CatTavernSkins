import DB from '../config/database';
import { generateAccessToken } from '../utils/crypto';

export interface Token {
  access_token: string;
  client_token?: string;
  user_id: string;
  profile_id?: string;
  issued_at: string;
  expires_at?: string;
  last_used_at?: string;
}

export interface CreateTokenDTO {
  clientToken?: string;
  userId: string;
  profileId?: string;
  expiresInDays?: number;
}

export class TokenModel {
  private static readonly DEFAULT_EXPIRES_DAYS = 15;

  /**
   * 创建令牌
   */
  static async create(dto: CreateTokenDTO): Promise<Token> {
    const accessToken = generateAccessToken();
    const clientToken = dto.clientToken || generateAccessToken().substring(0, 16);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || this.DEFAULT_EXPIRES_DAYS));

    // 插入令牌（access_token 和 token 列都写入相同的值）
    await DB.query(
      `INSERT INTO tokens (token, access_token, client_token, user_id, profile_id, expires_at, token_type) 
       VALUES ($1, $1, $2, $3, $4, $5, 'access')`,
      [accessToken, clientToken, dto.userId, dto.profileId || null, expiresAt.toISOString()]
    );

    return {
      access_token: accessToken,
      client_token: clientToken,
      user_id: dto.userId,
      profile_id: dto.profileId,
      issued_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * 通过 access_token 查找令牌
   */
  static async findByAccessToken(accessToken: string): Promise<Token | null> {
    const result = await DB.query(
      'SELECT * FROM tokens WHERE access_token = $1 LIMIT 1',
      [accessToken]
    );

    return result.rows[0] || null;
  }

  /**
   * 验证令牌是否有效
   */
  static async validate(accessToken: string, clientToken?: string): Promise<Token | null> {
    const token = await this.findByAccessToken(accessToken);

    if (!token) return null;
    if (clientToken && token.client_token !== clientToken) return null;
    
    // 检查是否过期
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      await this.delete(accessToken);
      return null;
    }

    return token;
  }

  /**
   * 删除令牌
   */
  static async delete(accessToken: string): Promise<void> {
    await DB.query(
      'DELETE FROM tokens WHERE access_token = $1',
      [accessToken]
    );
  }

  /**
   * 更新令牌绑定的角色
   */
  static async updateProfile(accessToken: string, profileId: string): Promise<void> {
    await DB.query(
      'UPDATE tokens SET profile_id = $1 WHERE access_token = $2',
      [profileId, accessToken]
    );
  }

  /**
   * 删除用户的所有令牌
   */
  static async deleteAllByUser(userId: string): Promise<void> {
    await DB.query(
      'DELETE FROM tokens WHERE user_id = $1',
      [userId]
    );
  }
}
