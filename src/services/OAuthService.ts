import { getOAuthConfig } from '../config/oauth';
import { OAuthAccountModel } from '../models/OAuthAccount';
import { UserModel, User } from '../models/User';
import { ProfileModel } from '../models/Profile';
import { generateUUID } from '../utils/uuid';
import { randomBytes } from 'crypto';

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
  ): Promise<{ user: User; isNewUser: boolean; profile: any }> {
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

    let oauthAccount = await OAuthAccountModel.findByProvider(provider, providerAccountId);

    if (oauthAccount) {
      await OAuthAccountModel.updateTokens(oauthAccount.id, accessToken, refreshToken);
      const user = await UserModel.findById(oauthAccount.user_id);
      if (!user) {
        throw new Error('Associated user not found');
      }
      return { user, isNewUser: false, profile };
    }

    const email = this.extractEmail(provider, profile);

    if (email) {
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        await OAuthAccountModel.create({
          user_id: existingUser.id,
          provider,
          provider_account_id: providerAccountId,
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return { user: existingUser, isNewUser: false, profile };
      }
    }

    const randomPassword = randomBytes(32).toString('base64');
    const newUser = await UserModel.create({
      email: email || `oauth_${provider}_${providerAccountId}@placeholder.local`,
      password: randomPassword,
      email_verified: email ? 1 : 0,
    });

    await OAuthAccountModel.create({
      user_id: newUser.id,
      provider,
      provider_account_id: providerAccountId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const profileName = this.extractProfileName(provider, profile);
    const sanitizedName = this.sanitizeProfileName(profileName);
    const finalName = await this.ensureUniqueProfileName(sanitizedName);

    await ProfileModel.create({
      name: finalName,
      userId: newUser.id,
    });

    return { user: newUser, isNewUser: true, profile };
  }

  static async getAvailableProviders(): Promise<{ github: boolean; microsoft: boolean }> {
    const config = getOAuthConfig();
    return {
      github: config.github.isConfigured,
      microsoft: config.microsoft.isConfigured,
    };
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

    let profile: any = await response.json();

    if (provider === 'github' && !profile.email) {
      profile.email = await this.fetchGitHubEmail(accessToken);
    }

    return profile;
  }

  private static async fetchGitHubEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Minecraft-Skin-Server',
          Accept: 'application/json',
        },
      });

      if (!response.ok) return null;

      const emails = (await response.json()) as any[];
      const primary = emails.find((e: any) => e.primary && e.verified);
      return primary?.email || emails[0]?.email || null;
    } catch {
      return null;
    }
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
