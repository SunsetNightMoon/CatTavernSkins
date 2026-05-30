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

    it('should create new user on GitHub callback', async () => {
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
        .mockResolvedValueOnce(mockProfileResponse);
      global.fetch = mockFetch;

      const result = await OAuthService.handleCallback('github', 'auth-code');
      expect(result.isNewUser).toBe(true);
      expect(result.user.id).toBe('new-user-id');
    });

    it('should link existing user when email matches', async () => {
      (OAuthAccountModel.findByProvider as jest.Mock).mockResolvedValue(null);
      (UserModel.findByEmail as jest.Mock).mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@test.com',
        role: 'user',
        level: 0,
      });
      (OAuthAccountModel.create as jest.Mock).mockResolvedValue({
        id: 'oauth-id',
        user_id: 'existing-user-id',
        provider: 'github',
        provider_account_id: '12345',
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
        .mockResolvedValueOnce(mockProfileResponse);
      global.fetch = mockFetch;

      const result = await OAuthService.handleCallback('github', 'auth-code');
      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe('existing-user-id');
    });
  });
});
