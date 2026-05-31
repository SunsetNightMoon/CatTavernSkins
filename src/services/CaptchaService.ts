import { TurnstileService } from './TurnstileService';

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}

const captchaStore = new Map<string, CaptchaEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of captchaStore.entries()) {
    if (entry.expiresAt < now) {
      captchaStore.delete(key);
    }
  }
}, 3600000);

export class CaptchaService {
  static isTurnstileEnabled(): boolean {
    return TurnstileService.isTurnstileConfigured();
  }

  static async verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
    return TurnstileService.verifyTurnstileToken(token, remoteIp);
  }

  static async generate(sessionId: string): Promise<{ question: string }> {
    const num1 = Math.floor(Math.random() * 90) + 10;
    const num2 = Math.floor(Math.random() * 90) + 10;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let question: string;
    let answer: number;

    switch (operator) {
      case '+':
        question = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
        break;
      case '-':
        const a = Math.max(num1, num2);
        const b = Math.min(num1, num2);
        question = `${a} - ${b} = ?`;
        answer = a - b;
        break;
      default:
        question = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
    }

    // 存储到内存（TTL 5分钟）
    captchaStore.set(sessionId, {
      answer: answer.toString(),
      expiresAt: Date.now() + 300000,
    });

    return { question };
  }

  /**
   * 验证答案
   */
  static async verify(sessionId: string, userAnswer: string): Promise<boolean> {
    const entry = captchaStore.get(sessionId);

    if (!entry) {
      return false; // 验证码不存在或已过期
    }

    // 检查是否过期
    if (entry.expiresAt < Date.now()) {
      captchaStore.delete(sessionId);
      return false;
    }

    const isCorrect = entry.answer === userAnswer.trim();

    captchaStore.delete(sessionId);

    return isCorrect;
  }
}
