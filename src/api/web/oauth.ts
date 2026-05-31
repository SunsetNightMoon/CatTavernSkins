import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { OAuthService } from '../../services/OAuthService';
import { TokenModel } from '../../models/Token';

const router = Router();

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
 *         description: 重定向到成功页面或登录页面
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
    const { user, isNewUser } = await OAuthService.handleCallback(
      provider as 'github' | 'microsoft',
      code as string
    );

    const token = await TokenModel.create({ userId: user.id });

    const redirectUrl = isNewUser
      ? `/oauth-success?token=${token.access_token}&new_user=true`
      : `/oauth-success?token=${token.access_token}`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect(`/login?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
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
    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000, sameSite: 'lax' });
    const url = OAuthService.getAuthorizationUrl(provider as 'github' | 'microsoft', state);
    res.redirect(url);
  } catch (error: any) {
    console.error('OAuth redirect error:', error);
    res.redirect(`/login?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

export default router;
