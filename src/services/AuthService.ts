import { UserModel, User } from '../models/User';
import { ProfileModel } from '../models/Profile';
import { TokenModel } from '../models/Token';
import { BlacklistModel } from '../models/Blacklist';
import { comparePassword } from '../utils/crypto';

// ========== 速率限制（简单内存实现，生产环境建议改用 Redis）==========
interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp ms
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;            // 每个窗口最多尝试次数
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 窗口大小：5 分钟

/**
 * 检查并更新速率限制
 * @returns 如果受限则抛出 Error（调用方捕获后返回 429）
 */
function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (entry && now < entry.resetAt) {
    // 在窗口内
    if (entry.count >= RATE_LIMIT_MAX) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      const err: any = new Error('Rate limit exceeded');
      err.retryAfter = retryAfterSec;
      throw err;
    }
    entry.count++;
  } else {
    // 窗口已过期或不存在，重置
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
  }
}

/**
 * 认证成功后重置速率限制计数器
 */
function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

// 定期清理过期条目（防止内存泄漏）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

export interface LoginResult {
  accessToken: string;
  clientToken: string;
  availableProfiles: Array<{ id: string; name: string }>;
  selectedProfile?: { id: string; name: string };
  user?: { id: string; properties?: any[] };
}

export class AuthService {
  /**
   * 用户登录认证（authenticate）
   */
  static async authenticate(
    username: string,
    password: string,
    clientToken?: string,
    requestUser: boolean = false
  ): Promise<LoginResult> {
    // 速率限制检查（per-username）
    checkRateLimit(username);

    // 查找用户（支持邮箱或角色名登录）
    let user: User | null = await UserModel.findByEmail(username);
    
    if (!user) {
      // 尝试通过角色名查找
      const profile = await ProfileModel.findByName(username);
      if (profile) {
        user = await UserModel.findById(profile.user_id);
      }
    }

    if (!user) {
      throw new Error('Invalid credentials. Invalid username or password.');
    }

    // 检查黑名单（启动器登录也受黑名单限制）
    const blacklistCheck = await BlacklistModel.checkBlacklist(user.email);
    if (blacklistCheck.isBlacklisted) {
      const banType = blacklistCheck.banInfo?.type;
      const banUntil = blacklistCheck.banInfo?.until;
      if (banType === 'permanent') {
        throw new Error('ForbiddenOperationException: Account is permanently banned.');
      } else if (banUntil) {
        throw new Error(`ForbiddenOperationException: Account is temporarily banned until ${banUntil}.`);
      }
    }

    // 检查用户是否被封禁（users表）
    const isBanned = await UserModel.isBanned(user);
    if (isBanned) {
      if (user.banned_until === 'permanent') {
        throw new Error('ForbiddenOperationException: Account is permanently banned.');
      } else {
        throw new Error(`ForbiddenOperationException: Account is banned until ${user.banned_until}.`);
      }
    }

    // 检查邮箱验证（未验证邮箱无法登录启动器）
    if (!user.email_verified) {
      throw new Error('ForbiddenOperationException: Email not verified. Please verify your email before logging in.');
    }

    // 验证密码
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials. Invalid username or password.');
    }

    // 创建令牌
    const token = await TokenModel.create({
      clientToken,
      userId: user.id,
    });

    // 获取用户的角色列表
    const profiles = await ProfileModel.findByUserId(user.id);
    const availableProfiles = profiles.map(p => ({
      id: p.id,
      name: p.name,
    }));

    const result: LoginResult = {
      accessToken: token.access_token,
      clientToken: token.client_token!,
      availableProfiles,
    };

    // 如果用户只有一个角色，自动选择
    if (profiles.length === 1) {
      result.selectedProfile = {
        id: profiles[0].id,
        name: profiles[0].name,
      };
      await TokenModel.updateProfile(token.access_token, profiles[0].id);
    }

    // 如果需要返回用户信息
    if (requestUser) {
      result.user = {
        id: user.id,
        properties: [],
      };
    }

    // 认证成功，重置速率限制
    resetRateLimit(username);

    return result;
  }

  /**
   * 刷新令牌（refresh）
   */
  static async refresh(
    accessToken: string,
    clientToken?: string,
    _requestUser: boolean = false,
    selectedProfile?: { id: string; name: string }
  ): Promise<LoginResult> {
    // 验证旧令牌
    const oldToken = await TokenModel.validate(accessToken, clientToken);
    if (!oldToken) {
      throw new Error('ForbiddenOperationException: Invalid token.');
    }

    // 规范检查：如果提供了 selectedProfile，旧令牌不能已有绑定的 profile
    if (selectedProfile && oldToken.profile_id) {
      throw new Error('ForbiddenOperationException: Access token already has a profile assigned.');
    }

    // 如果提供了 selectedProfile，检查是否属于该用户
    if (selectedProfile) {
      const profile = await ProfileModel.findById(selectedProfile.id);
      if (!profile || profile.user_id !== oldToken.user_id) {
        throw new Error('ForbiddenOperationException: Invalid token.');
      }
    }

    // 创建新令牌
    const newToken = await TokenModel.create({
      clientToken: oldToken.client_token,
      userId: oldToken.user_id,
      profileId: selectedProfile?.id || oldToken.profile_id,
    });

    // 删除旧令牌
    await TokenModel.delete(accessToken);

    // 获取用户的角色列表
    const profiles = await ProfileModel.findByUserId(newToken.user_id);
    const availableProfiles = profiles.map(p => ({
      id: p.id,
      name: p.name,
    }));

    const result: LoginResult = {
      accessToken: newToken.access_token,
      clientToken: newToken.client_token!,
      availableProfiles,
    };

    // 如果指定了角色，添加到结果
    if (newToken.profile_id) {
      const profile = await ProfileModel.findById(newToken.profile_id);
      if (profile) {
        result.selectedProfile = {
          id: profile.id,
          name: profile.name,
        };
      }
    }

    return result;
  }

  /**
   * 验证令牌（validate）
   */
  static async validate(accessToken: string, clientToken?: string): Promise<boolean> {
    const token = await TokenModel.validate(accessToken, clientToken);
    return token !== null;
  }

  /**
   * 吊销令牌（invalidate）
   */
  static async invalidate(accessToken: string, clientToken?: string): Promise<void> {
    const token = await TokenModel.findByAccessToken(accessToken);
    if (token && (!clientToken || token.client_token === clientToken)) {
      await TokenModel.delete(accessToken);
    }
  }

  /**
   * 用户登出（signout）
   */
  static async signout(username: string, password: string): Promise<void> {
    // 速率限制检查（per-username）
    checkRateLimit(username);

    const user = await UserModel.findByEmail(username);
    if (!user) {
      throw new Error('Invalid credentials. Invalid username or password.');
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials. Invalid username or password.');
    }

    // 删除用户的所有令牌
    await TokenModel.deleteAllByUser(user.id);

    // 登出成功，重置速率限制
    resetRateLimit(username);
  }
}
