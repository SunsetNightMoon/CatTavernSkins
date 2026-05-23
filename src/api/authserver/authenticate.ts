import { Router, Request, Response } from 'express';
import { AuthService } from '../../services/AuthService';

const router = Router();

/**
 * POST /authserver/authenticate
 * 用户登录认证
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
 * POST /authserver/refresh
 * 刷新访问令牌
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
 * POST /authserver/validate
 * 验证令牌有效性
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
 * POST /authserver/invalidate
 * 吊销令牌
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
 * POST /authserver/signout
 * 用户登出
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
