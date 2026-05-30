import { CaptchaService } from '../../../src/services/CaptchaService';
import { TurnstileService } from '../../../src/services/TurnstileService';

jest.mock('../../../src/services/TurnstileService');

describe('CaptchaService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('generate', () => {
    it('should generate captcha with arithmetic question', async () => {
      const result = await CaptchaService.generate('test-session');

      expect(result).toHaveProperty('question');
      expect(result.question).toMatch(/\d+\s*[+\-]\s*\d+\s*=\s*\?/);
    });
  });

  describe('verify', () => {
    it('should verify correct answer', async () => {
      const sessionId = 'test-session-correct';
      await CaptchaService.generate(sessionId);

      const generated = await CaptchaService.generate(sessionId);
      const match = generated.question.match(/(\d+)\s*([+\-])\s*(\d+)/);
      if (!match) return;
      const [, a, op, b] = match;
      const answer = op === '+' ? parseInt(a) + parseInt(b) : parseInt(a) - parseInt(b);

      const isValid = await CaptchaService.verify(sessionId, answer.toString());
      expect(isValid).toBe(true);
    });

    it('should reject wrong answer', async () => {
      const sessionId = 'test-session-wrong';
      await CaptchaService.generate(sessionId);

      const isValid = await CaptchaService.verify(sessionId, '99999');
      expect(isValid).toBe(false);
    });

    it('should reject expired captcha', async () => {
      const sessionId = 'test-session-expired';
      await CaptchaService.generate(sessionId);

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000);

      const isValid = await CaptchaService.verify(sessionId, '0');
      expect(isValid).toBe(false);
    });

    it('should delete captcha after verification (one-time use)', async () => {
      const sessionId = 'test-session-onetime';
      await CaptchaService.generate(sessionId);

      const generated = await CaptchaService.generate(sessionId);
      const match = generated.question.match(/(\d+)\s*([+\-])\s*(\d+)/);
      if (!match) return;
      const [, a, op, b] = match;
      const answer = op === '+' ? parseInt(a) + parseInt(b) : parseInt(a) - parseInt(b);

      const firstVerify = await CaptchaService.verify(sessionId, answer.toString());
      expect(firstVerify).toBe(true);

      const secondVerify = await CaptchaService.verify(sessionId, answer.toString());
      expect(secondVerify).toBe(false);
    });
  });

  describe('isTurnstileEnabled', () => {
    it('should return false when Turnstile is not configured', () => {
      (TurnstileService.isTurnstileConfigured as jest.Mock).mockReturnValue(false);
      expect(CaptchaService.isTurnstileEnabled()).toBe(false);
    });
  });
});
