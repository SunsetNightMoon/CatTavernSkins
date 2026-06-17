import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { OAuthService } from '../../services/OAuthService';
import type { CreateSecondAccountPayload } from '../../services/OAuthService';
import { TokenModel } from '../../models/Token';
import { UserModel, User } from '../../models/User';
import { BlacklistModel } from '../../models/Blacklist';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from './auth';

const router = Router();

// ─── 邮箱冲突挂起存储（单次使用、10 分钟 TTL，惰性过期，无定时器）──────────────
interface PendingConflictEntry {
  payload: CreateSecondAccountPayload;
  expiresAt: number;
}

const PENDING_TTL_MS = 10 * 60 * 1000; // 10 分钟
const pendingConflicts = new Map<string, PendingConflictEntry>();

/**
 * 惰性清理：读取时检查过期项并清理。
 * 注意：不使用 setInterval，以避免阻塞 jest 退出（--detectOpenHandles --forceExit）。
 */
function sweepExpiredPending(now: number): void {
  for (const [key, entry] of pendingConflicts.entries()) {
    if (entry.expiresAt < now) {
      pendingConflicts.delete(key);
    }
  }
}

function storePendingConflict(payload: CreateSecondAccountPayload): string {
  const now = Date.now();
  sweepExpiredPending(now);
  const id = randomUUID();
  pendingConflicts.set(id, { payload, expiresAt: now + PENDING_TTL_MS });
  return id;
}

/** 读取但不消费（用于 GET 详情）。过期返回 null 并清理。 */
function peekPendingConflict(id: string): PendingConflictEntry | null {
  const entry = pendingConflicts.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingConflicts.delete(id);
    return null;
  }
  return entry;
}

/** 读取并消费（单次使用，用于 POST 继续）。过期/缺失返回 null。 */
function consumePendingConflict(id: string): PendingConflictEntry | null {
  const entry = pendingConflicts.get(id);
  if (!entry) return null;
  pendingConflicts.delete(id);
  if (entry.expiresAt < Date.now()) {
    return null;
  }
  return entry;
}

/**
 * 在签发令牌前检查封禁/黑名单（与 src/api/web/auth.ts 登录逻辑保持一致）。
 * @returns 通用错误码（用于重定向 query）或 null（表示放行）。
 */
async function checkUserBlocked(user: User, clientIP: string): Promise<'oauth_blacklisted' | 'oauth_banned' | null> {
  const blacklistCheck = await BlacklistModel.checkBlacklist(user.email, clientIP);
  if (blacklistCheck.isBlacklisted) {
    return 'oauth_blacklisted';
  }
  const isBanned = await UserModel.isBanned(user);
  if (isBanned) {
    return 'oauth_banned';
  }
  return null;
}

/**
 * @openapi
 * /api/auth/oauth/{provider}/callback:
 *   get:
 *     tags: [OAuth]
 *     summary: OAuth 回调
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, microsoft]
 *         description: OAuth 提供商
 *     responses:
 *       302:
 *         description: 重定向到成功页面 / 冲突页面 / 登录页面
 */
router.get('/:provider/callback', async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { code, state } = req.query;

  if (!['github', 'microsoft'].includes(provider)) {
    return res.redirect('/login?error=oauth_invalid_provider');
  }

  const savedState = req.cookies?.oauth_state;
  if (!state || state !== savedState) {
    return res.redirect('/login?error=oauth_invalid_state');
  }
  res.clearCookie('oauth_state');

  if (!code) {
    return res.redirect('/login?error=oauth_no_code');
  }

  try {
    const result = await OAuthService.handleCallback(
      provider as 'github' | 'microsoft',
      code as string
    );

    if (result.status === 'email_conflict') {
      // 不创建/关联任何账户，仅暂存以待用户决策。绝不在 URL 中携带令牌。
      const pendingId = storePendingConflict({
        provider: result.provider,
        providerAccountId: result.providerAccountId,
        email: result.email,
        profileName: result.profileName,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        emailVerified: result.emailVerified,
      });
      return res.redirect(`/oauth-conflict?pending=${encodeURIComponent(pendingId)}`);
    }

    // result.status === 'authenticated'
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const blocked = await checkUserBlocked(result.user, clientIP);
    if (blocked) {
      return res.redirect(`/login?error=${blocked}`);
    }

    const token = await TokenModel.create({ userId: result.user.id });

    // 修复 H1：令牌改由 httpOnly Cookie 承载，绝不放入重定向 URL（避免泄露到历史 / Referer / 日志）。
    // 仅保留非敏感的 new_user 标志在 URL 中，供前端展示新用户引导。
    res.cookie(AUTH_COOKIE_NAME, token.access_token, getAuthCookieOptions());

    const redirectUrl = result.isNewUser
      ? `/oauth-success?new_user=true`
      : `/oauth-success`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    // 记录完整错误到服务端，重定向仅暴露通用错误码（修复 M4 错误信息回显）。
    console.error('OAuth callback error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

/**
 * @openapi
 * /api/auth/oauth/conflict/{pending}:
 *   get:
 *     tags: [OAuth]
 *     summary: 获取邮箱冲突挂起详情（不消费）
 *     parameters:
 *       - in: path
 *         name: pending
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 返回冲突邮箱与提供商（绝不返回令牌）
 *       410:
 *         description: 挂起请求不存在或已过期
 */
router.get('/conflict/:pending', async (req: Request, res: Response) => {
  const { pending } = req.params;
  const entry = peekPendingConflict(pending);
  if (!entry) {
    return res.status(410).json({ error: 'Gone', errorMessage: '请求已过期或不存在，请重新登录' });
  }
  return res.json({
    email: entry.payload.email,
    provider: entry.payload.provider,
  });
});

/**
 * @openapi
 * /api/auth/oauth/conflict/{pending}/continue:
 *   post:
 *     tags: [OAuth]
 *     summary: 邮箱冲突时继续创建第二个独立账户（单次使用）
 *     parameters:
 *       - in: path
 *         name: pending
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 返回新账户的访问令牌
 *       403:
 *         description: 账户被封禁或在黑名单中
 *       410:
 *         description: 挂起请求不存在或已过期
 *       500:
 *         description: 服务端错误
 */
router.post('/conflict/:pending/continue', async (req: Request, res: Response) => {
  const { pending } = req.params;

  // 单次使用：立即消费
  const entry = consumePendingConflict(pending);
  if (!entry) {
    return res.status(410).json({ error: 'Gone', errorMessage: '请求已过期或不存在，请重新登录' });
  }

  try {
    const user = await OAuthService.createSecondAccount(entry.payload);

    const clientIP = req.ip || req.socket.remoteAddress || '';
    const blocked = await checkUserBlocked(user, clientIP);
    if (blocked) {
      return res.status(403).json({
        error: 'Banned',
        errorMessage: blocked === 'oauth_banned' ? '该账号已被封禁' : '该账号已被列入黑名单',
      });
    }

    const token = await TokenModel.create({ userId: user.id });
    // 修复 H1：同时通过 httpOnly Cookie 下发令牌；仍在 JSON body 中返回，保持向后兼容。
    res.cookie(AUTH_COOKIE_NAME, token.access_token, getAuthCookieOptions());
    return res.json({ token: token.access_token, isNewUser: true });
  } catch (error: any) {
    console.error('OAuth conflict continue error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '创建账户失败，请重新登录' });
  }
});

/**
 * @openapi
 * /api/auth/oauth/providers:
 *   get:
 *     tags: [OAuth]
 *     summary: 获取可用 OAuth 提供商
 *     responses:
 *       200:
 *         description: 成功返回可用提供商列表
 */
router.get('/providers', async (_req: Request, res: Response) => {
  const providers = await OAuthService.getAvailableProviders();
  res.json(providers);
});

/**
 * @openapi
 * /api/auth/oauth/{provider}:
 *   get:
 *     tags: [OAuth]
 *     summary: 发起 OAuth 授权
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, microsoft]
 *         description: OAuth 提供商
 *     responses:
 *       302:
 *         description: 重定向到 OAuth 提供商授权页面
 *       400:
 *         description: 不支持的 OAuth 提供商
 */
router.get('/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;
  if (!['github', 'microsoft'].includes(provider)) {
    return res.status(400).json({ error: 'BadRequest', errorMessage: '不支持的 OAuth 提供商' });
  }

  try {
    const state = randomUUID();
    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    const url = OAuthService.getAuthorizationUrl(provider as 'github' | 'microsoft', state);
    res.redirect(url);
  } catch (error: any) {
    console.error('OAuth redirect error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

export default router;
