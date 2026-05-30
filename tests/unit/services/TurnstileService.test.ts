import { TurnstileService } from '../../../src/services/TurnstileService';

const originalEnv = process.env;

describe('TurnstileService', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isTurnstileConfigured', () => {
    it('should return false when env vars are missing', () => {
      expect(TurnstileService.isTurnstileConfigured()).toBe(false);
    });

    it('should return true when env vars are complete', () => {
      process.env.TURNSTILE_SITE_KEY = 'test-site-key';
      process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
      expect(TurnstileService.isTurnstileConfigured()).toBe(true);
    });
  });

  describe('verifyTurnstileToken', () => {
    it('should return true when token is valid', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = mockFetch;

      const result = await TurnstileService.verifyTurnstileToken('valid-token');
      expect(result).toBe(true);
    });

    it('should return false when token is invalid', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false }),
      });
      global.fetch = mockFetch;

      const result = await TurnstileService.verifyTurnstileToken('invalid-token');
      expect(result).toBe(false);
    });

    it('should return false on network error without throwing', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';

      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const result = await TurnstileService.verifyTurnstileToken('some-token');
      expect(result).toBe(false);
    });
  });
});
