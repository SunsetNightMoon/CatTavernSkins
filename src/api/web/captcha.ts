import { Router, Request, Response } from 'express';
import { CaptchaService } from '../../services/CaptchaService';

const router = Router();

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
router.get('/generate', async (req: Request, res: Response) => {
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

router.post('/verify-turnstile', async (req: Request, res: Response) => {
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
