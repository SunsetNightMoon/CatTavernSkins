import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { UserModel } from '../../models/User';
import { ProfileModel } from '../../models/Profile';
import { SkinModel } from '../../models/Skin';
import { TokenModel } from '../../models/Token';
import { BlacklistModel } from '../../models/Blacklist';
import DB from '../../config/database';
import { comparePassword } from '../../utils/crypto';
import { CaptchaService } from '../../services/CaptchaService';
import { sendVerificationEmail, verifyEmailToken, sendPasswordResetEmail } from '../../services/EmailService';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', errorMessage: '请求过于频繁，请稍后再试' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', errorMessage: '注册请求过于频繁，请稍后再试' },
});

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    // 检查是否允许注册
    if (process.env.ALLOW_REGISTRATION !== 'true') {
      return res.status(403).json({
        error: 'RegistrationDisabled',
        errorMessage: '当前不允许注册新用户，请联系管理员',
      });
    }

    const { email, password, profile_name, captcha_session_id, captcha_answer } = req.body;

    // 参数验证
    if (!email || !password || !profile_name) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '邮箱、密码和角色ID不能为空',
      });
    }

    // 验证角色名格式
    const profileNameRegex = /^[a-zA-Z0-9_]{3,16}$/;
    if (!profileNameRegex.test(profile_name)) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '角色ID需3-16个字符，仅限字母、数字和下划线',
      });
    }

    // 检查角色名是否已被使用（区分大小写）
    const existingProfile = await ProfileModel.findByName(profile_name);
    if (existingProfile) {
      return res.status(409).json({
        error: 'Conflict',
        errorMessage: '该角色ID已被使用',
      });
    }

    // 验证验证码（可通过 ENABLE_CAPTCHA=false 关闭）
    if (process.env.ENABLE_CAPTCHA !== 'false') {
      if (!captcha_session_id || !captcha_answer) {
        return res.status(400).json({
          error: 'BadRequest',
          errorMessage: '请完成人机验证',
        });
      }

      const isCaptchaValid = await CaptchaService.verify(captcha_session_id, captcha_answer);
      if (!isCaptchaValid) {
        return res.status(400).json({
          error: 'BadRequest',
          errorMessage: '验证码错误或已过期，请重新验证',
        });
      }
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '邮箱格式不正确',
      });
    }

    // 验证密码强度
    if (password.length < 6) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '密码长度至少6位',
      });
    }

    // 检查邮箱是否已存在
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        errorMessage: '该邮箱已被注册',
      });
    }

    // 检查黑名单（防止被封禁用户重新注册）
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const blacklistCheck = await BlacklistModel.checkBlacklist(email, clientIP);
    if (blacklistCheck.isBlacklisted) {
      const banType = blacklistCheck.banInfo?.type;
      const banUntil = blacklistCheck.banInfo?.until;
      let errorMessage = '该账号已被永久封禁，无法注册';
      if (banType === 'temporary' && banUntil) {
        errorMessage = `该账号已被暂时封禁，封禁期至 ${banUntil}，期间无法注册`;
      }
      return res.status(403).json({
        error: 'Banned',
        errorMessage,
        ban_type: banType,
        ban_until: banUntil,
      });
    }

    // 检查是否是第一个用户（超级管理员）
    const allUsers = await UserModel.findAll(1, 0);
    const isFirstUser = allUsers.length === 0;

    // 创建用户
    const user = await UserModel.create({
      email,
      password,
      role: isFirstUser ? 'super_admin' : 'user',
      level: isFirstUser ? 2 : 0,
      is_active: 1,
      email_verified: isFirstUser ? 1 : 0,
    });

    // 自动创建默认角色（使用用户输入的角色名）
    const profile = await ProfileModel.create({
      name: profile_name,
      userId: user.id,
    });

    res.status(201).json({
      message: '注册成功',
      isFirstUser,
      user: {
        id: user.id,
        user_uid: user.user_uid,
        email: user.email,
        role: user.role,
        level: user.level,
        is_active: user.is_active,
        email_verified: user.email_verified,
        banned_until: user.banned_until,
      },
      profile: {
        id: profile.id,
        name: profile.name,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '注册失败，请稍后重试',
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '邮箱和密码不能为空',
      });
    }

    // 查找用户
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '邮箱或密码错误',
      });
    }

    // 检查黑名单（防止被封禁用户通过任何方式登录）
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const blacklistCheck = await BlacklistModel.checkBlacklist(email, clientIP);
    if (blacklistCheck.isBlacklisted) {
      const banType = blacklistCheck.banInfo?.type;
      const banUntil = blacklistCheck.banInfo?.until;
      let errorMessage = '该账号已被永久封禁';
      if (banType === 'temporary' && banUntil) {
        errorMessage = `该账号已被暂时封禁，封禁期至 ${banUntil}`;
      }
      return res.status(403).json({
        error: 'Banned',
        errorMessage,
        ban_type: banType,
        ban_until: banUntil,
      });
    }

    // 检查封禁状态（users表中的封禁）
    const isBanned = await UserModel.isBanned(user);
    if (isBanned) {
      const until = user.banned_until === 'permanent'
        ? '永久封禁'
        : `封禁至 ${user.banned_until}`;
      return res.status(403).json({
        error: 'Banned',
        errorMessage: `账号已被 ${until}`,
        banned_until: user.banned_until,
      });
    }

    // 验证密码
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '邮箱或密码错误',
      });
    }

    // 创建令牌
    const token = await TokenModel.create({
      userId: user.id,
    });

    // 获取用户的角色列表
    const profiles = await ProfileModel.findByUserId(user.id);

    // 获取第一个角色的激活皮肤URL
    let skinUrl: string | undefined;
    const firstProfile = profiles[0];
    if (firstProfile?.skin_id) {
      const skin = await SkinModel.findById(firstProfile.skin_id);
      if (skin) {
        skinUrl = skin.file_path.replace(/^\.\//, '/');
      }
    }

    // 获取第一个角色名用于前端快捷显示
    const primaryProfile = profiles[0];
    const profileName = primaryProfile?.name || null;

    res.json({
      message: '登录成功',
      accessToken: token.access_token,
      clientToken: token.client_token,
      user: {
        id: user.id,
        user_uid: user.user_uid,
        email: user.email,
        role: user.role,
        level: user.level,
        is_active: user.is_active,
        email_verified: user.email_verified,
        banned_until: user.banned_until,
      },
      skinUrl,
      profileName,
      profiles: profiles.map(p => ({
        id: p.id,
        name: p.name,
        skin_id: p.skin_id,
      })),
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '登录失败，请稍后重试',
    });
  }
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: 'Missing or invalid access token',
      });
    }

    const accessToken = authHeader.substring(7);
    const token = await TokenModel.validate(accessToken);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '无效的认证令牌',
      });
    }

    const user = await UserModel.findById(token.user_id);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: '用户不存在',
      });
    }

    const profiles = await ProfileModel.findByUserId(user.id);
    const primaryProfile = profiles[0];
    const skinUrl = primaryProfile?.skin_id
      ? (await SkinModel.findById(primaryProfile.skin_id))?.file_path.replace(/^\.\//, '/')
      : undefined;

    res.json({
      user: {
        id: user.id,
        user_uid: user.user_uid,
        email: user.email,
        role: user.role,
        level: user.level,
        is_active: user.is_active,
        email_verified: user.email_verified,
        banned_until: user.banned_until,
      },
      profileName: primaryProfile?.name || null,
      skinUrl,
      profiles: profiles.map(p => ({
        id: p.id,
        name: p.name,
        skin_id: p.skin_id,
        cape_id: p.cape_id,
        name_changed_at: p.name_changed_at,
      })),
    });
  } catch (error: any) {
    console.error('Get me error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '获取用户信息失败',
    });
  }
});

/**
 * POST /api/auth/send-verification
 * 发送邮箱验证邮件
 */
router.post('/send-verification', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }
    const accessToken = authHeader.substring(7);
    const tokenRecord = await TokenModel.validate(accessToken);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '令牌无效' });
    }

    const user = await UserModel.findById(tokenRecord.user_id);
    if (!user) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '用户不存在' });
    }
    if (user.email_verified === 1) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '邮箱已验证，无需重复操作' });
    }

    const result = await sendVerificationEmail(user.email);
    if (!result.success) {
      if (result.error === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'EmailNotConfigured', errorMessage: '邮件服务未配置，请联系管理员' });
      }
      if (result.error === 'ALREADY_VERIFIED') {
        return res.status(400).json({ error: 'BadRequest', errorMessage: '邮箱已验证' });
      }
      // 把后端具体错误返回给前端
      return res.status(500).json({ error: 'SMTPSendFailed', errorMessage: result.error || '发送验证邮件失败' });
    }

    res.json({ message: '验证邮件已发送，请查收邮箱' });
  } catch (error: any) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '发送失败' });
  }
});

/**
 * GET /api/auth/verify-email
 * 验证邮箱（点击邮件链接）
 */
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).send(renderVerifyResult(false, '无效的验证链接'));
    }

    const result = await verifyEmailToken(token);
    if (!result.success) {
      return res.status(400).send(renderVerifyResult(false, '验证链接已失效或已过期，请重新发送验证邮件'));
    }

    res.send(renderVerifyResult(true, `邮箱 ${result.email} 验证成功！`));
  } catch (error: any) {
    console.error('Verify email error:', error);
    res.status(500).send(renderVerifyResult(false, '验证失败，请稍后重试'));
  }
});

/**
 * 渲染验证结果页面（纯 HTML，供浏览器访问）
 */
function renderVerifyResult(success: boolean, message: string): string {
  const color = success ? '#52c41a' : '#ff4d4f';
  const bgGradient = success
    ? 'radial-gradient(ellipse at top, #1a2e1a 0%, #0d1117 60%)'
    : 'radial-gradient(ellipse at top, #2e1a1a 0%, #0d1117 60%)';
  const icon = success
    ? `<svg width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#52c41a" stroke-width="3"/><path d="M20 33l8 8 16-16" stroke="#52c41a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#ff4d4f" stroke-width="3"/><path d="M24 24l16 16M40 24l-16 16" stroke="#ff4d4f" stroke-width="3" stroke-linecap="round"/></svg>`;
  const title = success ? '验证成功' : '验证失败';

  const successActions = `
    <button class="btn btn-primary" onclick="tryClose()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px;margin-right:6px;"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      关闭窗口
    </button>
    <div class="hint" id="closeHint" style="display:none;margin-top:12px;">
      如果窗口未关闭，请手动点击浏览器标签页的 × 按钮关闭。
    </div>
    <script>
      function tryClose() {
        window.opener = null;
        window.open('', '_self');
        window.close();
        document.getElementById('closeHint').style.display = 'block';
      }
    </script>
  `;

  const failActions = `
    <a href="/profile" class="btn btn-primary">前往个人中心重新验证</a>
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Minecraft Skin Server</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0d1117;
      background-image: ${bgGradient};
      color: #c9d1d9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: rgba(22, 27, 34, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(48, 54, 61, 0.6);
      border-radius: 20px;
      padding: 56px 44px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: fadeInUp 0.5s ease-out;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-wrap {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${success ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)'};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      animation: scaleIn 0.4s ease-out 0.15s both;
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.6); }
      to { opacity: 1; transform: scale(1); }
    }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 12px; color: ${color}; }
    p.message { font-size: 15px; color: #8b949e; line-height: 1.7; margin-bottom: 32px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 11px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    .btn-primary {
      background: ${color};
      color: #fff;
    }
    .btn-primary:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
      box-shadow: 0 8px 20px ${success ? 'rgba(82, 196, 26, 0.3)' : 'rgba(255, 77, 79, 0.3)'};
    }
    .hint {
      font-size: 13px;
      color: #6e7681;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .server-name {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: #484f58;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">${icon}</div>
    <h1>${title}</h1>
    <p class="message">${message}</p>
    ${success ? successActions : failActions}
  </div>
  <div class="server-name">Minecraft Skin Server</div>
</body>
</html>`;
}

/**
 * POST /api/auth/change-password
 * 修改密码（需原密码）
 */
router.post('/change-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = authHeader.slice(7);
    const tokenRecord = await TokenModel.validate(token);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '令牌无效或已过期' });
    }

    const user = await UserModel.findById(tokenRecord.user_id);
    if (!user) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '用户不存在' });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请输入原密码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '新密码长度至少6位' });
    }

    const valid = await comparePassword(oldPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'InvalidCredentials', errorMessage: '原密码错误' });
    }

    await UserModel.updatePassword(user.id, newPassword);
    res.json({ message: '密码已修改，请使用新密码重新登录' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '修改密码失败' });
  }
});

/**
 * POST /api/auth/send-reset-email
 * 发送密码重置邮件（已登录用户）
 */
router.post('/send-reset-email', authLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = authHeader.slice(7);
    const tokenRecord = await TokenModel.validate(token);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '令牌无效或已过期' });
    }

    const user = await UserModel.findById(tokenRecord.user_id);
    if (!user) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '用户不存在' });
    }

    const result = await sendPasswordResetEmail(user.email);
    if (!result.success) {
      if (result.error === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'EmailNotConfigured', errorMessage: '邮件服务未配置' });
      }
      return res.status(500).json({ error: 'SendFailed', errorMessage: result.error || '发送失败' });
    }

    res.json({ message: '密码重置邮件已发送，请查收邮箱' });
  } catch (error: any) {
    console.error('Send reset email error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '发送失败' });
  }
});

/**
 * POST /api/auth/reset-password
 * 使用验证码重置密码
 */
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { code, newPassword } = req.body;

    if (!code || !newPassword) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请输入验证码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '新密码长度至少6位' });
    }

    const user = await UserModel.findByVerificationToken(code);
    if (!user) {
      return res.status(400).json({ error: 'InvalidCode', errorMessage: '验证码无效或已过期' });
    }

    await UserModel.updatePassword(user.id, newPassword);
    // 清除验证 token
    await UserModel.setVerificationToken(user.email, '', '');

    res.json({ message: '密码已重置，请使用新密码登录' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '重置密码失败' });
  }
});

/**
 * 注销账号
 * POST /api/auth/delete-account
 * body: { password: string }
 * 需要验证密码，超级管理员不能注销
 */
router.post('/delete-account', authLimiter, async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = authHeader.slice(7);
    const tokenRecord = await TokenModel.validate(token);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '令牌无效或已过期' });
    }

    const userId = tokenRecord.user_id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '用户不存在' });
    }

    // 超级管理员不能注销
    if (user.level >= 2) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: '超级管理员不能注销账号' });
    }

    // 验证密码
    if (!password) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请输入密码' });
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'InvalidCredentials', errorMessage: '密码错误' });
    }

    // 删除用户的所有相关数据
    // 1. 删除皮肤文件和数据
    const skins = await DB.query('SELECT file_path FROM skins WHERE user_id = $1', [userId]);
    const fsPromises = require('fs/promises');
    const pathModule = require('path');
    for (const skin of skins.rows) {
      if (skin.file_path) {
        const filePath = pathModule.resolve(process.cwd(), skin.file_path);
        await fsPromises.unlink(filePath).catch(() => {});
      }
    }
    await DB.query('DELETE FROM skins WHERE user_id = $1', [userId]);

    // 2. 删除披风文件和数据
    const capes = await DB.query('SELECT file_path FROM capes WHERE user_id = $1', [userId]);
    for (const cape of capes.rows) {
      if (cape.file_path) {
        const filePath = pathModule.resolve(process.cwd(), cape.file_path);
        await fsPromises.unlink(filePath).catch(() => {});
      }
    }
    await DB.query('DELETE FROM capes WHERE user_id = $1', [userId]);

    // 3. 删除角色
    await DB.query('DELETE FROM profiles WHERE user_id = $1', [userId]);

    // 4. 删除收藏
    await DB.query('DELETE FROM skin_favorites WHERE user_id = $1', [userId]);
    await DB.query('DELETE FROM cape_favorites WHERE user_id = $1', [userId]);

    // 5. 删除令牌
    await DB.query('DELETE FROM tokens WHERE user_id = $1', [userId]);

    // 6. 删除用户
    await DB.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: '账号已注销' });
  } catch (error: any) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '注销失败，请稍后重试' });
  }
});

export default router;
