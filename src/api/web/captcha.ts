import { Router, Request, Response } from 'express';
import { CaptchaService } from '../../services/CaptchaService';

const router = Router();

/**
 * GET /api/captcha/generate
 * 生成验证码
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
 * POST /api/captcha/verify
 * 验证答案
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

export default router;
