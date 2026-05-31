import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { CaptchaService } from '../../services/CaptchaService';

const router = Router();

// 限制验证码生成：每 IP 60 秒内最多 30 次，防止内存放大型 DoS (M3a)
const captchaGenerateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', errorMessage: '请求过于频繁，请稍后再试' },
});

// 限制 Turnstile 校验：每 IP 60 秒内最多 20 次，防止对 Cloudflare 的放大请求 (M3a)
const verifyTurnstileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', errorMessage: '请求过于频繁，请稍后再试' },
});

/**
 * @openapi
 * /api/captcha/generate:
 *   get:
 *     tags: [验证码]
 *     summary: 生成验证码
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: 验证码会话ID（可选，不传则自动生成）
 *     responses:
 *       200:
 *         description: 验证码生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 question:
 *                   type: string
 */
router.get('/generate', captchaGenerateLimiter, async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string || crypto.randomUUID();
    const { question } = await CaptchaService.generate(sessionId);
    res.json({ sessionId, question });
  } catch (error: any) {
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

/**
 * @openapi
 * /api/captcha/verify:
 *   post:
 *     tags: [验证码]
 *     summary: 验证答案
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, answer]
 *             properties:
 *               sessionId:
 *                 type: string
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: 验证成功
 *       400:
 *         description: 验证失败或参数不完整
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { sessionId, answer } = req.body;

    if (!sessionId || !answer) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '参数不完整' });
    }

    const isCorrect = await CaptchaService.verify(sessionId, answer);
    
    if (isCorrect) {
      res.json({ success: true, message: '验证成功' });
    } else {
      res.status(400).json({ success: false, message: '验证失败，请重试' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

router.post('/verify-turnstile', verifyTurnstileLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '缺少 Turnstile token' });
    }

    const remoteIp = req.ip || req.socket.remoteAddress;
    const isValid = await CaptchaService.verifyTurnstile(token, remoteIp);

    if (isValid) {
      res.json({ success: true, message: 'Turnstile 验证成功' });
    } else {
      res.status(400).json({ success: false, message: 'Turnstile 验证失败' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

router.get('/captcha-type', (_req: Request, res: Response) => {
  const type = CaptchaService.isTurnstileEnabled() ? 'turnstile' : 'math';
  const siteKey = process.env.TURNSTILE_SITE_KEY || '';
  res.json({ type, siteKey });
});

export default router;
