import DB from '../config/database';
import { generateUUID } from '../utils/uuid';

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: 'github' | 'microsoft';
  provider_account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOAuthAccountDTO {
  user_id: string;
  provider: 'github' | 'microsoft';
  provider_account_id: string;
  access_token?: string;
  refresh_token?: string;
}

export class OAuthAccountModel {
  static async create(data: CreateOAuthAccountDTO): Promise<OAuthAccount> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const result = await DB.query(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, refresh_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, data.user_id, data.provider, data.provider_account_id, data.access_token || null, data.refresh_token || null, now, now]
    );

    return result.rows[0];
  }

  static async findByProvider(provider: string, providerAccountId: string): Promise<OAuthAccount | null> {
    const result = await DB.query(
      'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1',
      [provider, providerAccountId]
    );

    return result.rows[0] || null;
  }

  static async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const result = await DB.query(
      'SELECT * FROM oauth_accounts WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    return result.rows;
  }

  static async updateTokens(id: string, accessToken: string, refreshToken?: string): Promise<void> {
    const now = new Date().toISOString();

    if (refreshToken) {
      await DB.query(
        'UPDATE oauth_accounts SET access_token = $1, refresh_token = $2, updated_at = $3 WHERE id = $4',
        [accessToken, refreshToken, now, id]
      );
    } else {
      await DB.query(
        'UPDATE oauth_accounts SET access_token = $1, updated_at = $2 WHERE id = $3',
        [accessToken, now, id]
      );
    }
  }

  static async delete(id: string): Promise<void> {
    await DB.query(
      'DELETE FROM oauth_accounts WHERE id = $1',
      [id]
    );
  }
}
