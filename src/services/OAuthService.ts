import { getOAuthConfig } from '../config/oauth';
import { OAuthAccountModel } from '../models/OAuthAccount';
import { UserModel, User } from '../models/User';
import { ProfileModel } from '../models/Profile';
import { generateUUID } from '../utils/uuid';
import { randomBytes } from 'crypto';

/**
 * 第二账户创建载荷（用于邮箱冲突时“继续”创建一个全新的独立账户）。
 */
export interface CreateSecondAccountPayload {
  provider: 'github' | 'microsoft';
  providerAccountId: string;
  email: string;
  profileName: string | null;
  accessToken?: string;
  refreshToken?: string;
  emailVerified: boolean;
}

/**
 * handleCallback 返回的判别联合类型。
 * - authenticated: OAuth 登录已确定（已存在的关联账户，或全新创建的账户）。
 * - email_conflict: 该 OAuth 身份的邮箱与某个已存在账户冲突，需要用户决策。
 *   此时尚未创建/关联任何账户，所有继续创建第二账户所需的信息都随结果返回。
 */
export type OAuthCallbackResult =
  | { status: 'authenticated'; user: User; isNewUser: boolean }
  | {
      status: 'email_conflict';
      provider: 'github' | 'microsoft';
      providerAccountId: string;
      email: string;
      profileName: string | null;
      accessToken: string;
      refreshToken?: string;
      emailVerified: boolean;
    };

export class OAuthService {
  static getAuthorizationUrl(provider: 'github' | 'microsoft', state: string): string {
    const config = getOAuthConfig();
    const providerConfig = config[provider];

    if (!providerConfig.isConfigured) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    const callbackUrl = `${config.callbackBaseUrl}/api/auth/oauth/${provider}/callback`;

    if (provider === 'github') {
      const params = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: callbackUrl,
        scope: 'user:email',
        state,
      });
      return `${providerConfig.authorizeUrl}?${params.toString()}`;
    }

    if (provider === 'microsoft') {
      const params = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid profile email User.Read',
        state,
      });
      return `${providerConfig.authorizeUrl}?${params.toString()}`;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  static async handleCallback(
    provider: 'github' | 'microsoft',
    code: string
  ): Promise<OAuthCallbackResult> {
    const config = getOAuthConfig();
    const providerConfig = config[provider];

    if (!providerConfig.isConfigured) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    const callbackUrl = `${config.callbackBaseUrl}/api/auth/oauth/${provider}/callback`;

    const tokenResponse = await this.exchangeCodeForToken(providerConfig, code, callbackUrl);
    const accessToken = tokenResponse.access_token;
    const refreshToken = tokenResponse.refresh_token;

    const profile = await this.fetchUserProfile(provider, accessToken);

    const providerAccountId = String(profile.id);

    // 1) 已存在的 OAuth 关联账户：直接登录，刷新令牌。
    const oauthAccount = await OAuthAccountModel.findByProvider(provider, providerAccountId);
    if (oauthAccount) {
      await OAuthAccountModel.updateTokens(oauthAccount.id, accessToken, refreshToken);
      const user = await UserModel.findById(oauthAccount.user_id);
      if (!user) {
        throw new Error('Associated user not found');
      }
      return { status: 'authenticated', user, isNewUser: false };
    }

    const email = this.extractEmail(provider, profile);
    const emailVerified = this.isEmailVerified(provider, profile, email);
    const profileName = this.extractProfileName(provider, profile);

    // 2) 没有 OAuth 关联，但邮箱命中了某个已存在账户：返回冲突，交由用户决策。
    //    重要：此处不创建、不关联任何账户（修复 C1 静默自动关联漏洞）。
    if (email) {
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return {
          status: 'email_conflict',
          provider,
          providerAccountId,
          email,
          profileName,
          accessToken,
          refreshToken,
          emailVerified,
        };
      }
    }

    // 3) 既无 OAuth 关联也无邮箱冲突：创建全新账户。
    const newUser = await this.createUserWithAccount({
      provider,
      providerAccountId,
      email: email || `oauth_${provider}_${providerAccountId}@placeholder.local`,
      emailVerified: !!(email && emailVerified),
      profileName,
      accessToken,
      refreshToken,
    });

    return { status: 'authenticated', user: newUser, isNewUser: true };
  }

  /**
   * 邮箱冲突场景下的“继续”动作：创建一个全新的、独立的账户。
   * 由于 users.email 具有 UNIQUE 约束且该邮箱已属于另一账户，必须使用占位邮箱
   * 来避免唯一约束冲突。占位邮箱永远视为未验证（email_verified = 0）。
   */
  static async createSecondAccount(payload: CreateSecondAccountPayload): Promise<User> {
    // 竞态保护：若期间该 OAuth 身份已被创建关联，直接返回已存在的用户。
    const existing = await OAuthAccountModel.findByProvider(payload.provider, payload.providerAccountId);
    if (existing) {
      const linkedUser = await UserModel.findById(existing.user_id);
      if (linkedUser) return linkedUser;
    }

    const placeholderEmail = `oauth_${payload.provider}_${payload.providerAccountId}@placeholder.local`;

    return this.createUserWithAccount({
      provider: payload.provider,
      providerAccountId: payload.providerAccountId,
      email: placeholderEmail,
      emailVerified: false, // 占位邮箱永远不视为已验证
      profileName: payload.profileName,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
  }

  static async getAvailableProviders(): Promise<{ github: boolean; microsoft: boolean }> {
    const config = getOAuthConfig();
    return {
      github: config.github.isConfigured,
      microsoft: config.microsoft.isConfigured,
    };
  }

  /**
   * 创建用户 + OAuth 关联 + 角色档案。
   *
   * 注意：当前数据库抽象层（DB.query）没有可供各 Model 复用的事务句柄
   * （getConnection 返回的原始连接无法被静态 Model 调用使用），因此这里采用
   * 务实的“顺序写入 + try/catch + 唯一冲突重查”的尽力而为方案，避免半成品状态。
   */
  private static async createUserWithAccount(payload: {
    provider: 'github' | 'microsoft';
    providerAccountId: string;
    email: string;
    emailVerified: boolean;
    profileName: string | null;
    accessToken?: string;
    refreshToken?: string;
  }): Promise<User> {
    const randomPassword = randomBytes(32).toString('base64');
    const newUser = await UserModel.create({
      email: payload.email,
      password: randomPassword,
      email_verified: payload.emailVerified ? 1 : 0,
    });

    try {
      await OAuthAccountModel.create({
        user_id: newUser.id,
        provider: payload.provider,
        provider_account_id: payload.providerAccountId,
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });

      const sanitizedName = this.sanitizeProfileName(payload.profileName);
      const finalName = await this.ensureUniqueProfileName(sanitizedName);
      await ProfileModel.create({
        name: finalName,
        userId: newUser.id,
      });
    } catch (err) {
      // 尽力而为的恢复：若 OAuth 关联或档案创建因竞态/唯一冲突失败，
      // 重查该 OAuth 身份是否已被并发请求创建关联；若是则复用，否则抛出原错误。
      const existing = await OAuthAccountModel.findByProvider(payload.provider, payload.providerAccountId);
      if (existing) {
        const linkedUser = await UserModel.findById(existing.user_id);
        if (linkedUser) return linkedUser;
      }
      throw err;
    }

    return newUser;
  }

  private static async exchangeCodeForToken(
    providerConfig: any,
    code: string,
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token?: string }> {
    const body = new URLSearchParams({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (providerConfig.authorizeUrl.includes('github')) {
      headers['Accept'] = 'application/json';
    }

    const response = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as { access_token: string; refresh_token?: string };
    }

    const text = await response.text();
    const params = new URLSearchParams(text);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') || undefined;

    if (!accessToken) {
      throw new Error('No access_token in token response');
    }

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private static async fetchUserProfile(provider: 'github' | 'microsoft', accessToken: string): Promise<any> {
    const config = getOAuthConfig();
    const providerConfig = config[provider];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (provider === 'github') {
      headers['User-Agent'] = 'Minecraft-Skin-Server';
      headers['Accept'] = 'application/json';
    }

    const response = await fetch(providerConfig.apiUrl, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch user profile: ${text}`);
    }

    const profile: any = await response.json();

    if (provider === 'github') {
      // 始终通过 /user/emails 端点确认邮箱与验证状态。
      // GitHub 的 /user 响应不会告知邮箱是否已验证，因此只信任 primary && verified 的地址。
      const { email, verified } = await this.fetchGitHubEmail(accessToken);
      profile.email = email; // 仅来自 primary && verified 的地址，否则为 null
      profile.__emailVerified = verified;
    }

    return profile;
  }

  /**
   * 获取 GitHub 主邮箱。
   * 仅返回 primary && verified 的地址；不再回退到未验证的 emails[0]。
   */
  private static async fetchGitHubEmail(
    accessToken: string
  ): Promise<{ email: string | null; verified: boolean }> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Minecraft-Skin-Server',
          Accept: 'application/json',
        },
      });

      if (!response.ok) return { email: null, verified: false };

      const emails = (await response.json()) as any[];
      const primary = Array.isArray(emails)
        ? emails.find((e: any) => e.primary && e.verified)
        : undefined;

      if (primary?.email) {
        return { email: primary.email, verified: true };
      }

      return { email: null, verified: false };
    } catch {
      return { email: null, verified: false };
    }
  }

  /**
   * 判定从 profile 中提取的邮箱是否为已验证的、可信的邮箱。
   * - github: 仅当邮箱来自 /user/emails 的 primary && verified 地址时才为 true。
   * - microsoft: 仅 profile.mail 是可信的已验证邮箱；userPrincipalName 不算。
   */
  private static isEmailVerified(
    provider: 'github' | 'microsoft',
    profile: any,
    email: string | null
  ): boolean {
    if (!email) return false;

    if (provider === 'github') {
      return profile.__emailVerified === true;
    }

    if (provider === 'microsoft') {
      // 默认 common 租户下，仅信任 profile.mail；userPrincipalName 非已验证邮箱。
      return !!profile.mail && email === profile.mail;
    }

    return false;
  }

  private static extractEmail(provider: 'github' | 'microsoft', profile: any): string | null {
    if (provider === 'github') {
      return profile.email || null;
    }
    if (provider === 'microsoft') {
      return profile.mail || profile.userPrincipalName || null;
    }
    return null;
  }

  private static extractProfileName(provider: 'github' | 'microsoft', profile: any): string | null {
    if (provider === 'github') {
      return profile.login || null;
    }
    if (provider === 'microsoft') {
      return profile.displayName || null;
    }
    return null;
  }

  private static sanitizeProfileName(name: string | null): string {
    if (!name) {
      return `Player${Math.floor(Math.random() * 100000)}`;
    }

    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 16);

    if (sanitized.length < 3) {
      return `Player${Math.floor(Math.random() * 100000)}`;
    }

    return sanitized;
  }

  private static async ensureUniqueProfileName(name: string): Promise<string> {
    const existing = await ProfileModel.findByName(name);
    if (!existing) return name;

    const baseName = name.substring(0, 11);
    let attempts = 0;
    while (attempts < 10) {
      const candidate = `${baseName}${Math.floor(Math.random() * 10000)}`;
      const candidateExists = await ProfileModel.findByName(candidate);
      if (!candidateExists) return candidate;
      attempts++;
    }

    return `${baseName}${generateUUID().substring(0, 5)}`;
  }
}
