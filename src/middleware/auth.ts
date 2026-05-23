import { Request, Response, NextFunction } from 'express';
import { TokenModel } from '../models/Token';
import { UserModel } from '../models/User';

/**
 * 认证中间件 - 验证用户是否已登录
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '未提供认证令牌',
      });
    }

    const token = authHeader.substring(7);
    const tokenRecord = await TokenModel.validate(token);

    if (!tokenRecord) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '无效的认证令牌',
      });
    }

    // 获取用户信息
    const user = await UserModel.findById(tokenRecord.user_id);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '用户不存在',
      });
    }

    // 将用户信息附加到请求对象
    (req as any).user = user;
    (req as any).token = tokenRecord;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 管理员中间件 - 验证用户是否为管理员或更高角色
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      errorMessage: '未认证',
    });
  }

  // 检查用户角色级别 (0=普通用户, 1=管理员, 2=超级管理员)
  if (user.level < 1) {
    return res.status(403).json({
      error: 'Forbidden',
      errorMessage: '权限不足，需要管理员权限',
    });
  }

  next();
}

/**
 * 超级管理员中间件 - 验证用户是否为超级管理员
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      errorMessage: '未认证',
    });
  }

  // 检查用户角色级别 (2=超级管理员)
  if (user.level < 2) {
    return res.status(403).json({
      error: 'Forbidden',
      errorMessage: '权限不足，需要超级管理员权限',
    });
  }

  next();
}
