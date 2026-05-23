import DB from '../config/database';
import { generateUUID } from '../utils/uuid';

export interface User {
  id: string;
  user_uid: number;
  email: string;
  password_hash: string;
  role: string;
  level: number;
  is_active: number;
  email_verified: number;
  banned_until: string | null; // null = 未封禁, 'permanent' = 永久封禁, 其他日期字符串 = 封禁到指定日期
  verification_token?: string;
  verification_expires?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  role?: string;
  level?: number;
  is_active?: number;
  email_verified?: number;
}

export class UserModel {
  /**
   * 创建用户
   */
  static async create(dto: CreateUserDTO): Promise<User> {
    const id = generateUUID();
    const { hashPassword } = require('../utils/crypto');
    const password_hash = await hashPassword(dto.password);

    const dbType = process.env.DB_TYPE || 'sqlite';

    const role = dto.role || 'user';
    const level = dto.level ?? 0;
    const is_active = dto.is_active ?? 1;
    const email_verified = dto.email_verified ?? 0;

    let result;
    if (dbType === 'sqlite') {
      const uidResult = await DB.query('SELECT COALESCE(MAX(user_uid), 0) + 1 as next_uid FROM users');
      const userUid = uidResult.rows[0].next_uid;
      result = await DB.query(
        `INSERT INTO users (id, user_uid, email, password_hash, role, level, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, userUid, dto.email, password_hash, role, level, is_active, email_verified]
      );
    } else {
      result = await DB.query(
        `INSERT INTO users (id, email, password_hash, role, level, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, dto.email, password_hash, role, level, is_active, email_verified]
      );
    }

    return result.rows[0];
  }

  /**
   * 通过邮箱查找用户
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await DB.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * 通过ID查找用户
   */
  static async findById(id: string): Promise<User | null> {
    const result = await DB.query(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * 通过UID查找用户
   */
  static async findByUID(userUid: number): Promise<User | null> {
    const result = await DB.query(
      'SELECT * FROM users WHERE user_uid = $1 LIMIT 1',
      [userUid]
    );

    return result.rows[0] || null;
  }

  /**
   * 更新密码
   */
  static async updatePassword(id: string, newPassword: string): Promise<void> {
    const { hashPassword } = require('../utils/crypto');
    const password_hash = await hashPassword(newPassword);
    const today = new Date().toISOString();

    await DB.query(
      'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [password_hash, today, id]
    );
  }

  /**
   * 更新邮箱验证状态
   */
  static async setEmailVerified(email: string, verified: boolean): Promise<void> {
    await DB.query(
      'UPDATE users SET email_verified = $1, verification_token = NULL, verification_expires = NULL WHERE email = $2',
      [verified ? 1 : 0, email]
    );
  }

  /**
   * 通过验证token查找用户
   */
  static async findByVerificationToken(token: string): Promise<User | null> {
    const result = await DB.query(
      `SELECT * FROM users 
       WHERE verification_token = $1 
       AND verification_expires > CURRENT_TIMESTAMP
       LIMIT 1`,
      [token]
    );

    return result.rows[0] || null;
  }

  /**
   * 设置验证token
   */
  static async setVerificationToken(email: string, token: string, expires: string): Promise<void> {
    await DB.query(
      'UPDATE users SET verification_token = $1, verification_expires = $2 WHERE email = $3',
      [token, expires, email]
    );
  }

  /**
   * 更新角色和等级（管理员功能）
   */
  static async updateRole(id: string, role: string, level: number): Promise<void> {
    const today = new Date().toISOString();

    await DB.query(
      'UPDATE users SET role = $1, level = $2, updated_at = $3 WHERE id = $4',
      [role, level, today, id]
    );
  }

  /**
   * 获取所有用户（管理员功能）
   */
  static async findAll(limit: number = 20, offset: number = 0): Promise<User[]> {
    const result = await DB.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows;
  }

  /**
   * 更新封禁状态
   * @param id 用户ID
   * @param bannedUntil null = 解除封禁, 'permanent' = 永久封禁, 其他日期 = 封禁到指定日期
   */
  static async updateBanStatus(id: string, bannedUntil: string | null): Promise<void> {
    const today = new Date().toISOString();
    await DB.query(
      'UPDATE users SET banned_until = $1, updated_at = $2 WHERE id = $3',
      [bannedUntil, today, id]
    );
  }

  /**
   * 检查用户是否被封禁（自动检查是否已过期）
   */
  static async isBanned(user: User): Promise<boolean> {
    if (!user.banned_until) return false;
    if (user.banned_until === 'permanent') return true;
    return new Date(user.banned_until) > new Date();
  }
}
