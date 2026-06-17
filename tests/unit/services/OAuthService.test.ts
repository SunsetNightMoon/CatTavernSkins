jest.mock('../../../src/config/database', () => {
  class MockDB {
    static async query(_sql: string, _params: any[] = []): Promise<{ rows: any[] }> {
      return { rows: [] };
    }
    static async getConnection() { return {}; }
    static async resetPostgresPool() {}
    static async resetSQLite() {}
  }
  return { DB: MockDB, default: MockDB };
});

import { OAuthService } from '../../../src/services/OAuthService';
import { OAuthAccountModel } from '../../../src/models/OAuthAccount';
import { UserModel } from '../../../src/models/User';
import { ProfileModel } from '../../../src/models/Profile';

jest.mock('../../../src/models/OAuthAccount');
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Profile');

const originalEnv = process.env;

describe('OAuthService', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getAvailableProviders', () => {
    it('should return configured providers', async () => {
      process.env.GITHUB_CLIENT_ID = 'github-id';
      process.env.GITHUB_CLIENT_SECRET = 'github-secret';
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      const result = await OAuthService.getAvailableProviders();
      expect(result.github).toBe(true);
      expect(result.microsoft).toBe(false);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct GitHub authorization URL', () => {
      process.env.GITHUB_CLIENT_ID = 'test-github-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
      process.env.OAUTH_CALLBACK_BASE_URL = 'http://localhost:3000';

      const url = OAuthService.getAuthorizationUrl('github', 'test-state');
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-github-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('scope=user%3Aemail');
    });

    it('should generate correct Microsoft authorization URL', () => {
      process.env.MICROSOFT_CLIENT_ID = 'test-ms-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'test-ms-secret';
      process.env.OAUTH_CALLBACK_BASE_URL = 'http://localhost:3000';

      const url = OAuthService.getAuthorizationUrl('microsoft', 'test-state');
      expect(url).toContain('https://login.microsoftonline.com/');
      expect(url).toContain('client_id=test-ms-id');
      expect(url).toContain('state=test-state');
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      process.env.GITHUB_CLIENT_ID = 'test-github-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
      process.env.OAUTH_CALLBACK_BASE_URL = 'http://localhost:3000';
    });

    // 现在 github 总是调用 /user/emails 端点确认验证状态，因此需要第三个 mock 响应。
    const githubEmailsResponse = (email: string) => ({
      ok: true,
      json: () =>
        Promise.resolve([{ email, primary: true, verified: true }]),
    });

    it('should create new user on GitHub callback (authenticated, isNewUser:true)', async () => {
      (OAuthAccountModel.findByProvider as jest.Mock).mockResolvedValue(null);
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      (UserModel.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        email: 'test@github.com',
        role: 'user',
        level: 0,
        is_active: 1,
        email_verified: 1,
      });
      (OAuthAccountModel.create as jest.Mock).mockResolvedValue({
        id: 'oauth-id',
        user_id: 'new-user-id',
        provider: 'github',
        provider_account_id: '12345',
      });
      (ProfileModel.findByName as jest.Mock).mockResolvedValue(null);
      (ProfileModel.create as jest.Mock).mockResolvedValue({
        id: 'profile-id',
        name: 'testuser',
        user_id: 'new-user-id',
      });

      const mockTokenResponse = {
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ access_token: 'ghp_test123', refresh_token: 'ghr_test456' }),
      };
      const mockProfileResponse = {
        ok: true,
        json: () => Promise.resolve({ id: 12345, login: 'testuser', email: 'test@github.com' }),
      };

      const mockFetch = jest.fn()
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockProfileResponse)
        .mockResolvedValueOnce(githubEmailsResponse('test@github.com'));
      global.fetch = mockFetch as any;

      const result = await OAuthService.handleCallback('github', 'auth-code');
      expect(result.status).toBe('authenticated');
      if (result.status !== 'authenticated') throw new Error('expected authenticated');
      expect(result.isNewUser).toBe(true);
      expect(result.user.id).toBe('new-user-id');
      // 新用户应携带正确的已验证邮箱（primary && verified）
      expect((UserModel.create as jest.Mock)).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@github.com', email_verified: 1 })
      );
    });

    it('should return email_conflict when email matches an existing user (no auto-link)', async () => {
      (OAuthAccountModel.findByProvider as jest.Mock).mockResolvedValue(null);
      (UserModel.findByEmail as jest.Mock).mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@test.com',
        role: 'user',
        level: 0,
      });

      const mockTokenResponse = {
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ access_token: 'ghp_test123', refresh_token: 'ghr_test456' }),
      };
      const mockProfileResponse = {
        ok: true,
        json: () => Promise.resolve({ id: 12345, login: 'existinguser', email: 'existing@test.com' }),
      };

      const mockFetch = jest.fn()
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockProfileResponse)
        .mockResolvedValueOnce(githubEmailsResponse('existing@test.com'));
      global.fetch = mockFetch as any;

      const result = await OAuthService.handleCallback('github', 'auth-code');

      expect(result.status).toBe('email_conflict');
      if (result.status !== 'email_conflict') throw new Error('expected email_conflict');
      expect(result.email).toBe('existing@test.com');
      expect(result.provider).toBe('github');
      expect(result.providerAccountId).toBe('12345');
      expect(result.emailVerified).toBe(true);
      // 关键：冲突场景下绝不创建/关联任何 OAuth 账户
      expect(OAuthAccountModel.create as jest.Mock).not.toHaveBeenCalled();
      expect(UserModel.create as jest.Mock).not.toHaveBeenCalled();
    });
  });

  describe('createSecondAccount', () => {
    beforeEach(() => {
      process.env.GITHUB_CLIENT_ID = 'test-github-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
      process.env.OAUTH_CALLBACK_BASE_URL = 'http://localhost:3000';
    });

    it('should create a brand-new independent user with a placeholder email', async () => {
      (OAuthAccountModel.findByProvider as jest.Mock).mockResolvedValue(null);
      (UserModel.create as jest.Mock).mockResolvedValue({
        id: 'second-user-id',
        email: 'oauth_github_12345@placeholder.local',
        role: 'user',
        level: 0,
        is_active: 1,
        email_verified: 0,
      });
      (OAuthAccountModel.create as jest.Mock).mockResolvedValue({
        id: 'oauth-id-2',
        user_id: 'second-user-id',
        provider: 'github',
        provider_account_id: '12345',
      });
      (ProfileModel.findByName as jest.Mock).mockResolvedValue(null);
      (ProfileModel.create as jest.Mock).mockResolvedValue({
        id: 'profile-id-2',
        name: 'existinguser',
        user_id: 'second-user-id',
      });

      const user = await OAuthService.createSecondAccount({
        provider: 'github',
        providerAccountId: '12345',
        email: 'existing@test.com',
        profileName: 'existinguser',
        accessToken: 'ghp_test123',
        refreshToken: 'ghr_test456',
        emailVerified: true,
      });

      expect(user.id).toBe('second-user-id');
      // 必须使用占位邮箱以避免 UNIQUE 冲突，且占位邮箱永远未验证
      expect(UserModel.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'oauth_github_12345@placeholder.local',
          email_verified: 0,
        })
      );
      expect(OAuthAccountModel.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'second-user-id',
          provider: 'github',
          provider_account_id: '12345',
        })
      );
      expect(ProfileModel.create as jest.Mock).toHaveBeenCalled();
    });

    it('should return existing user on race (provider already linked)', async () => {
      (OAuthAccountModel.findByProvider as jest.Mock).mockResolvedValue({
        id: 'oauth-id-existing',
        user_id: 'racing-user-id',
        provider: 'github',
        provider_account_id: '12345',
      });
      (UserModel.findById as jest.Mock).mockResolvedValue({
        id: 'racing-user-id',
        email: 'oauth_github_12345@placeholder.local',
        role: 'user',
        level: 0,
      });

      const user = await OAuthService.createSecondAccount({
        provider: 'github',
        providerAccountId: '12345',
        email: 'existing@test.com',
        profileName: 'existinguser',
        accessToken: 'ghp_test123',
        emailVerified: true,
      });

      expect(user.id).toBe('racing-user-id');
      // 竞态命中时不应再次创建用户
      expect(UserModel.create as jest.Mock).not.toHaveBeenCalled();
    });
  });
});
