import { Router, Request, Response } from 'express';
import { AuthService } from '../../services/AuthService';

const router = Router();

/**
 * @openapi
 * /authserver/authenticate:
 *   post:
 *     tags: [Yggdrasil认证]
 *     summary: Yggdrasil 认证
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户邮箱
 *               password:
 *                 type: string
 *               clientToken:
 *                 type: string
 *                 description: 客户端令牌（可选）
 *               requestUser:
 *                 type: boolean
 *                 description: 是否请求用户信息（可选）
 *     responses:
 *       200:
 *         description: 认证成功
 *       400:
 *         description: 参数错误
 *       403:
 *         description: 凭据无效
 *       429:
 *         description: 请求过于频繁
 */
router.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const { username, password, clientToken, requestUser } = req.body;

    // 参数验证
    if (!username || !password) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Missing username or password',
      });
    }

    // 调用认证服务
    const result = await AuthService.authenticate(
      username,
      password,
      clientToken,
      requestUser
    );

    res.json(result);
  } catch (error: any) {
    // 速率限制
    if (error.message === 'Rate limit exceeded' && error.retryAfter) {
      res.set('Retry-After', String(error.retryAfter));
      return res.status(429).json({
        error: 'TooManyRequests',
        errorMessage: `Too many requests. Please retry after ${error.retryAfter} seconds.`,
      });
    }

    if (error.message.includes('Invalid credentials')) {
      return res.status(403).json({
        error: 'ForbiddenOperationException',
        errorMessage: 'Invalid credentials. Invalid username or password.',
      });
    }

    console.error('Authenticate error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: '服务器内部错误',
    });
  }
});

/**
 * @openapi
 * /authserver/refresh:
 *   post:
 *     tags: [Yggdrasil认证]
 *     summary: Yggdrasil 令牌刷新
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: 访问令牌
 *               clientToken:
 *                 type: string
 *                 description: 客户端令牌（可选）
 *               requestUser:
 *                 type: boolean
 *                 description: 是否请求用户信息（可选）
 *     responses:
 *       200:
 *         description: 刷新成功
 *       400:
 *         description: 参数错误
 *       403:
 *         description: 令牌无效
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { accessToken, clientToken, requestUser, selectedProfile } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Missing accessToken',
      });
    }

    const result = await AuthService.refresh(
      accessToken,
      clientToken,
      requestUser,
      selectedProfile
    );

    res.json(result);
  } catch (error: any) {
    if (error.message.includes('Invalid token')) {
      return res.status(403).json({
        error: 'ForbiddenOperationException',
        errorMessage: 'Invalid token.',
      });
    }

    console.error('Refresh error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: '服务器内部错误',
    });
  }
});

/**
 * @openapi
 * /authserver/validate:
 *   post:
 *     tags: [Yggdrasil认证]
 *     summary: Yggdrasil 令牌验证
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: 访问令牌
 *               clientToken:
 *                 type: string
 *                 description: 客户端令牌（可选）
 *     responses:
 *       204:
 *         description: 令牌有效
 *       403:
 *         description: 令牌无效
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { accessToken, clientToken } = req.body;

    if (!accessToken) {
      return res.status(400).send();
    }

    const valid = await AuthService.validate(accessToken, clientToken);
    
    if (valid) {
      res.status(204).send();
    } else {
      res.status(403).json({
        error: 'ForbiddenOperationException',
        errorMessage: 'Invalid token.',
      });
    }
  } catch (error) {
    res.status(403).json({
      error: 'ForbiddenOperationException',
      errorMessage: 'Invalid token.',
    });
  }
});

/**
 * @openapi
 * /authserver/invalidate:
 *   post:
 *     tags: [Yggdrasil认证]
 *     summary: Yggdrasil 令牌注销
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: 访问令牌
 *               clientToken:
 *                 type: string
 *                 description: 客户端令牌（可选）
 *     responses:
 *       204:
 *         description: 注销成功
 */
router.post('/invalidate', async (req: Request, res: Response) => {
  try {
    const { accessToken, clientToken } = req.body;

    if (accessToken) {
      await AuthService.invalidate(accessToken, clientToken);
    }

    res.status(204).send();
  } catch (error) {
    res.status(204).send();
  }
});

/**
 * @openapi
 * /authserver/signout:
 *   post:
 *     tags: [Yggdrasil认证]
 *     summary: Yggdrasil 登出
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户邮箱
 *               password:
 *                 type: string
 *                 description: 密码
 *     responses:
 *       204:
 *         description: 登出成功
 *       400:
 *         description: 参数错误
 *       403:
 *         description: 凭据无效
 *       429:
 *         description: 请求过于频繁
 */
router.post('/signout', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Missing username or password',
      });
    }

    await AuthService.signout(username, password);
    res.status(204).send();
  } catch (error: any) {
    // 速率限制
    if (error.message === 'Rate limit exceeded' && error.retryAfter) {
      res.set('Retry-After', String(error.retryAfter));
      return res.status(429).json({
        error: 'TooManyRequests',
        errorMessage: `Too many requests. Please retry after ${error.retryAfter} seconds.`,
      });
    }

    if (error.message.includes('Invalid credentials')) {
      return res.status(403).json({
        error: 'ForbiddenOperationException',
        errorMessage: 'Invalid credentials. Invalid username or password.',
      });
    }

    console.error('Signout error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: '服务器内部错误',
    });
  }
});

export default router;
