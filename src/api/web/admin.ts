import { Router, Request, Response, NextFunction } from 'express';
import DB from '../../config/database';
import { UserModel } from '../../models/User';
import { SkinModel } from '../../models/Skin';
import { CapeModel } from '../../models/Cape';
import { TokenModel } from '../../models/Token';
import { BlacklistModel } from '../../models/Blacklist';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../../middleware/auth';
import { UserLevel, UserRole } from '../../types/constants';
import { sendVerificationEmail } from '../../services/EmailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Multer 配置（用于首页背景图片上传 —— 存到 bg/homepage/ 以完善文件夹分类）
const bgStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.resolve(process.cwd(), 'public', 'uploads', 'bg', 'homepage');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `bg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  },
});
// 允许的图片/视频格式（支持 APNG、WebP、WebM、MP4，不支持 GIF）
const ALLOWED_BG_EXTS = ['.jpg', '.jpeg', '.png', '.apng', '.webp', '.webm', '.mp4'];
const uploadBg = multer({
  storage: bgStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制（支持视频背景）
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_BG_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的图片格式：${ext}。仅支持 ${ALLOWED_BG_EXTS.join(', ')}`));
    }
  },
});

/**
 * 获取系统统计数据
 */
router.get('/stats', requireAuth, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 获取用户总数
    const userCountResult = await DB.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(String(userCountResult.rows[0].count || '0'), 10);

    // 获取皮肤总数
    const skinCountResult = await DB.query('SELECT COUNT(*) as count FROM skins');
    const skinCount = parseInt(String(skinCountResult.rows[0].count || '0'), 10);

    // 获取待审核皮肤数量
    const pendingCountResult = await DB.query("SELECT COUNT(*) as count FROM skins WHERE approval_status = 'pending'");
    const pendingCount = parseInt(String(pendingCountResult.rows[0].count || '0'), 10);

    res.json({
      userCount,
      skinCount,
      pendingCount,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取近 N 天每日统计数据（用于图表）
 * GET /api/admin/stats/daily?days=7
 */
router.get('/stats/daily', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days + 1);
    const dateStr = dateLimit.toISOString().split('T')[0];

    // 查询近 N 天内的所有相关记录（按日期分组）
    const skinRows = await DB.query(
      `SELECT DATE(created_at) as date FROM skins WHERE created_at >= $1`,
      [dateStr]
    );
    const capeRows = await DB.query(
      `SELECT DATE(created_at) as date FROM capes WHERE created_at >= $1`,
      [dateStr]
    );
    const userRows = await DB.query(
      `SELECT DATE(created_at) as date FROM users WHERE created_at >= $1`,
      [dateStr]
    );
    const pendingSkinRows = await DB.query(
      `SELECT DATE(created_at) as date FROM skins WHERE created_at >= $1 AND approval_status = 'pending'`,
      [dateStr]
    );
    const pendingCapeRows = await DB.query(
      `SELECT DATE(created_at) as date FROM capes WHERE created_at >= $1 AND approval_status = 'pending'`,
      [dateStr]
    );
    const banRows = await DB.query(
      `SELECT DATE(created_at) as date FROM blacklist WHERE created_at >= $1`,
      [dateStr]
    );

    // 构建连续日期数组并填充数据
    const daysArray: string[] = [];
    const skinUploads: number[] = [];
    const capeUploads: number[] = [];
    const userRegistrations: number[] = [];
    const pendingSubmissions: number[] = [];
    const banCounts: number[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - days + 1 + i);
      const ds = d.toISOString().split('T')[0];
      daysArray.push(ds);

      const skinCount = (skinRows.rows as any[]).filter(
        (r: any) => {
          const rowDate = r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10);
          return rowDate === ds;
        }
      ).length;
      skinUploads.push(skinCount);

      const capeCount = (capeRows.rows as any[]).filter(
        (r: any) => {
          const rowDate = r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10);
          return rowDate === ds;
        }
      ).length;
      capeUploads.push(capeCount);

      const userCount = (userRows.rows as any[]).filter(
        (r: any) => {
          const rowDate = r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10);
          return rowDate === ds;
        }
      ).length;
      userRegistrations.push(userCount);

      const pendingCount =
        (pendingSkinRows.rows as any[]).filter(
          (r: any) => {
            const rowDate = r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10);
            return rowDate === ds;
          }
        ).length +
        (pendingCapeRows.rows as any[]).filter(
          (r: any) => {
            const rowDate = r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10);
            return rowDate === ds;
          }
        ).length;
      pendingSubmissions.push(pendingCount);

      const banCount = (banRows.rows as any[]).filter(
        (r: any) => {
          const rowDate = r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10);
          return rowDate === ds;
        }
      ).length;
      banCounts.push(banCount);
    }

    res.json({
      days: daysArray,
      skinUploads,
      capeUploads,
      userRegistrations,
      pendingSubmissions,
      banCounts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [管理员]
 *     summary: 获取用户列表
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 偏移量
 *     responses:
 *       200:
 *         description: 成功返回用户列表
 *       401:
 *         description: 未认证
 *       403:
 *         description: 权限不足
 */
router.get('/users', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offsetNum = Math.max(0, parseInt(req.query.offset as string) || 0);
    const users = await UserModel.findAll(limitNum, offsetNum);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * 切换用户激活状态
 * 权限：不能操作自己，不能操作同级或更高级用户
 */
router.put('/users/:id/toggle-active', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    // 不能操作自己
    if (currentUser.id === id) {
      return res.status(400).json({ error: '不能操作自己的活跃状态' });
    }

    // 获取目标用户状态
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 不能操作比自己等级高或相同的管理员
    if (user.level >= currentUser.level) {
      return res.status(400).json({ error: '权限不足，无法操作此用户' });
    }

    // 切换状态 (is_active 为 INTEGER: 0=禁用, 1=启用)
    const newStatus = user.is_active ? 0 : 1;
    await DB.query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, id]);

    // 如果禁用用户，删除所有令牌
    if (!newStatus) {
      await TokenModel.deleteAllByUser(id);
    }

    res.json({ message: 'User status updated successfully' });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * 修改用户角色
 */
router.put('/users/:id/change-role', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { level } = req.body;

    // 验证 level
    if (!Object.values(UserLevel).includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // 获取当前用户
    const currentUser = (req as any).user;
    
    // 不能修改自己的角色
    if (currentUser.id === id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // 设置角色
    let role: string = UserRole.USER;
    if (level === UserLevel.SUPER_ADMIN) role = UserRole.SUPER_ADMIN;
    else if (level === UserLevel.ADMIN) role = UserRole.ADMIN;

    await UserModel.updateRole(id, role, level);

    // 删除用户的所有 token，强制重新登录以获取新权限
    await TokenModel.deleteAllByUser(id);

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * 获取待审核皮肤列表
 */
router.get('/skins/pending', requireAuth, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await DB.query(
      `SELECT s.*, u.user_uid,
              (SELECT p.name FROM profiles p WHERE p.user_id = s.user_id LIMIT 1) as uploader_name
       FROM skins s
       JOIN users u ON s.user_id = u.id
       WHERE s.approval_status = 'pending'
       ORDER BY s.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * 通过皮肤审核
 */
router.put('/skins/:id/approve', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    await SkinModel.updateApprovalStatus(id, 'approved', currentUser.id);

    res.json({ message: 'Skin approved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 拒绝皮肤审核
 */
router.put('/skins/:id/reject', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;
    const { reason } = req.body;

    await SkinModel.updateApprovalStatus(id, 'rejected', currentUser.id, reason);

    res.json({ message: 'Skin rejected successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取待审核披风列表
 */
router.get('/capes/pending', requireAuth, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await DB.query(
      `SELECT c.*, u.user_uid,
              (SELECT p.name FROM profiles p WHERE p.user_id = c.user_id LIMIT 1) as uploader_name
       FROM capes c
       JOIN users u ON c.user_id = u.id
       WHERE c.approval_status = 'pending'
       ORDER BY c.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * 通过披风审核
 */
router.put('/capes/:id/approve', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    await CapeModel.updateApprovalStatus(id, 'approved', currentUser.id);

    res.json({ message: 'Cape approved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 拒绝披风审核
 */
router.put('/capes/:id/reject', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;
    const { reason } = req.body;

    await CapeModel.updateApprovalStatus(id, 'rejected', currentUser.id, reason);

    res.json({ message: 'Cape rejected successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取所有披风列表（管理员用）
 * GET /api/admin/capes?page=1&limit=20
 */
router.get('/capes', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await CapeModel.findAllForAdmin(page, limit);
    res.json({ capes: result.capes, total: result.total, page, limit });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新披风信息（管理员用）
 * PUT /api/admin/capes/:id
 */
router.put('/capes/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, license_type, permission_level } = req.body;

    const cape = await CapeModel.findById(id);
    if (!cape) {
      return res.status(404).json({ error: '披风不存在' });
    }

    await CapeModel.updateInfo(id, { name, description, license_type, permission_level });
    res.json({ message: '披风信息已更新' });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * 删除披风（管理员用）
 * DELETE /api/admin/capes/:id
 */
router.delete('/capes/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cape = await CapeModel.findById(id);
    if (!cape) {
      return res.status(404).json({ error: '披风不存在' });
    }

    // 删除披风文件
    if (cape.file_path) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), cape.file_path);
      await fs.unlink(filePath).catch(() => {});
    }

    await CapeModel.delete(id);
    res.json({ message: '披风已删除' });
  } catch (error) {
    next(error);
  }
});

/**
 * 封禁/解封用户
 * POST /api/admin/users/:id/ban
 * body: { bannedUntil: string | null } // null = 解除封禁, 'permanent' = 永久封禁, 日期字符串 = 封禁到指定日期
 */
router.post('/users/:id/ban', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { bannedUntil } = req.body;
    const currentUser = (req as any).user;

    // 不能封禁自己
    if (currentUser.id === id) {
      return res.status(400).json({ error: '不能封禁自己' });
    }

    // 获取目标用户
    const targetUser = await UserModel.findById(id);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能封禁比自己等级高或相同的管理员
    if (targetUser.level >= currentUser.level) {
      return res.status(400).json({ error: '权限不足，无法封禁此用户' });
    }

    // 验证日期格式
    if (bannedUntil !== null && bannedUntil !== 'permanent') {
      const date = new Date(bannedUntil);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: '无效的日期格式' });
      }
      // 不能封禁到过去的日期
      if (date <= new Date()) {
        return res.status(400).json({ error: '封禁截止日期必须是将来的时间' });
      }
    }

    await UserModel.updateBanStatus(id, bannedUntil);

    // 如果封禁用户，删除所有令牌使其强制登出
    if (bannedUntil !== null) {
      await TokenModel.deleteAllByUser(id);
    }

    const action = bannedUntil === null ? '已解除封禁' : bannedUntil === 'permanent' ? '已被永久封禁' : `已被封禁至 ${bannedUntil}`;
    res.json({ message: `用户 ${action}` });
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * @openapi
 * /api/admin/users/{id}/role:
 *   put:
 *     tags: [管理员]
 *     summary: 更新用户信息
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level]
 *             properties:
 *               level:
 *                 type: integer
 *                 description: 用户等级
 *     responses:
 *       200:
 *         description: 更新成功
 *       400:
 *         description: 参数错误
 *       401:
 *         description: 未认证
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 用户不存在
 */
router.put('/users/:id/role', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { level } = req.body;

    // 验证 level
    if (!Object.values(UserLevel).includes(level)) {
      return res.status(400).json({ error: '无效的等级值，Level 必须为 0、1 或 2' });
    }

    const currentUser = (req as any).user;

    // 不能修改自己的角色
    if (currentUser.id === id) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    // 获取目标用户
    const targetUser = await UserModel.findById(id);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能修改比自己等级高或相同的管理员
    if (targetUser.level >= currentUser.level) {
      return res.status(400).json({ error: '权限不足，无法修改此用户的角色' });
    }

    // 不能将任何人设为与自己相同或更高的等级
    if (level >= currentUser.level) {
      return res.status(400).json({ error: '不能将用户设为与自己相同或更高的等级' });
    }

    // 设置角色
    let role: string = UserRole.USER;
    if (level === UserLevel.SUPER_ADMIN) role = UserRole.SUPER_ADMIN;
    else if (level === UserLevel.ADMIN) role = UserRole.ADMIN;

    await UserModel.updateRole(id, role, level);

    // 删除用户的所有 token，强制重新登录以获取新权限
    await TokenModel.deleteAllByUser(id);

    res.json({ message: '用户角色已更新，用户需重新登录以应用新权限' });
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * 获取所有皮肤列表（管理员用）
 * GET /api/admin/skins?page=1&limit=20
 */
router.get('/skins', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skins = await SkinModel.findAll(page, limit);
    const total = await SkinModel.countAll();
    res.json({ skins, total, page, limit });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新皮肤信息（管理员用）
 * PUT /api/admin/skins/:id
 */
router.put('/skins/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, license_type, permission_level } = req.body;

    const skin = await SkinModel.findById(id);
    if (!skin) {
      return res.status(404).json({ error: 'Skin not found' });
    }

    await SkinModel.updateInfo(id, { name, description, license_type, permission_level });
    res.json({ message: '皮肤信息已更新' });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * 删除皮肤（管理员用）
 * DELETE /api/admin/skins/:id
 */
router.delete('/skins/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const skin = await SkinModel.findById(id);
    if (!skin) {
      return res.status(404).json({ error: 'Skin not found' });
    }

    // 删除皮肤文件
    if (skin.file_path) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), skin.file_path);
      await fs.unlink(filePath).catch(() => {});
    }

    await SkinModel.delete(id);
    res.json({ message: '皮肤已删除' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 系统设置读取/写入（.env 文件）
// ============================================================
// 前端表单字段名 → .env 键名 映射
export const SETTINGS_MAP: Record<string, string> = {
  allow_registration: 'ALLOW_REGISTRATION',
  require_email_verification: 'REQUIRE_EMAIL_VERIFICATION',
  enable_captcha: 'ENABLE_CAPTCHA',
  base_url: 'BASE_URL',
  smtp_host: 'SMTP_HOST',
  smtp_port: 'SMTP_PORT',
  smtp_secure: 'SMTP_SECURE',
  smtp_user: 'SMTP_USER',
  smtp_pass: 'SMTP_PASS',
  smtp_from: 'SMTP_FROM',
  smtp_from_name: 'SMTP_FROM_NAME',
  // 站点自定义设置
  site_title: 'SITE_TITLE',
  site_description: 'SITE_DESCRIPTION',
  homepage_title_text: 'HOMEPAGE_TITLE_TEXT',
  homepage_text: 'HOMEPAGE_TEXT',
  homepage_button_text: 'HOMEPAGE_BUTTON_TEXT',
  homepage_buttons: 'HOMEPAGE_BUTTONS',
  homepage_bg_image: 'HOMEPAGE_BG_IMAGE',
  // 主题设置
  light_bg_image: 'LIGHT_BG_IMAGE',
  dark_bg_image: 'DARK_BG_IMAGE',
  light_bg_overlay_opacity: 'LIGHT_BG_OVERLAY_OPACITY',
  dark_bg_overlay_opacity: 'DARK_BG_OVERLAY_OPACITY',
  // 登录/注册页面背景图
  login_bg_image: 'LOGIN_BG_IMAGE',
  // 登录/注册页面内嵌图片
  login_embed_image: 'LOGIN_EMBED_IMAGE',
  // WebM 视频静音
  video_muted: 'VIDEO_MUTED',
  // 网站图标
  site_favicon: 'SITE_FAVICON',
  // 版权设置
  copyright_text: 'COPYRIGHT_TEXT',
  copyright_beian: 'COPYRIGHT_BEIAN',
};

export const SETTINGS_DEFAULTS: Record<string, string> = {
  ALLOW_REGISTRATION: 'true',
  REQUIRE_EMAIL_VERIFICATION: 'true',
  ENABLE_CAPTCHA: 'true',
  BASE_URL: 'http://localhost:3000',
  SMTP_HOST: '',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: '',
  SMTP_FROM: '',
  SMTP_FROM_NAME: '',
  // 站点自定义设置默认值
  SITE_TITLE: 'CatTavernSkins',
  SITE_DESCRIPTION: 'Minecraft Skin Server - 自定义你的游戏形象',
  SITE_FAVICON: '/favicon.svg',
  HOMEPAGE_TITLE_TEXT: '欢迎来到',
  HOMEPAGE_TEXT: 'WELCOME TO SKIN2!',
  HOMEPAGE_BUTTON_TEXT: '进入个人中心',
  HOMEPAGE_BUTTONS: '[]',
  HOMEPAGE_BG_IMAGE: '',
  // 主题设置默认值
  LIGHT_BG_IMAGE: '',
  DARK_BG_IMAGE: '',
  LIGHT_BG_OVERLAY_OPACITY: '30',
  DARK_BG_OVERLAY_OPACITY: '30',
  // 登录/注册页面背景图默认值
  LOGIN_BG_IMAGE: '',
  // 登录/注册页面内嵌图片默认值
  LOGIN_EMBED_IMAGE: '',
  // WebM 视频静音默认值（默认静音）
  VIDEO_MUTED: 'true',
  // 版权设置默认值
  COPYRIGHT_TEXT: '© 2024 Minecraft Skin Server',
  COPYRIGHT_BEIAN: '',
  // 项目版权标识（硬编码，不可通过管理面板更改）
  COPYRIGHT_PROJECT: 'Powered by CatTavernSkins',
};

/**
 * GET /api/settings/public
 * 获取公开站点设置（无需认证）
 */
/**
 * GET /api/admin/settings
 * 读取系统设置（从 .env 文件）
 */
router.get('/settings', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');

    const settings: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      settings[key] = trimmed.substring(eqIdx + 1).trim();
    }

    // 返回所有映射键，缺失的使用默认值
    const result: Record<string, string> = {};
    for (const envKey of Object.values(SETTINGS_MAP)) {
      let value = settings[envKey] ?? SETTINGS_DEFAULTS[envKey] ?? '';
      if (envKey === 'SMTP_PASS' && value) {
        value = '***';
      }
      result[envKey] = value;
    }
    res.json(result);
  } catch (error: any) {
    console.error('Read settings error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '读取设置失败' });
  }
});

/**
 * PUT /api/admin/settings
 * 更新系统设置（写入 .env 文件，并实时更新 process.env）
 */
router.put('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    const updates: Record<string, any> = req.body;
    const lines = content.split('\n');
    const updatedKeys = new Set<string>();

    // 将前端字段转换为 .env 格式
    const envUpdates: Record<string, string> = {};
    for (const [frontendKey, rawValue] of Object.entries(updates)) {
      const envKey = SETTINGS_MAP[frontendKey];
      if (!envKey) continue;

      let strValue: string;
      if (typeof rawValue === 'boolean') {
        strValue = rawValue ? 'true' : 'false';
      } else {
        strValue = String(rawValue ?? '');
      }

      // 密码为空或占位符时跳过（不修改密码）
      if (envKey === 'SMTP_PASS' && (!strValue || strValue === '***')) {
        continue;
      }

      envUpdates[envKey] = strValue;
    }

    // 更新已有行
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      if (key in envUpdates) {
        lines[i] = `${key}=${envUpdates[key]}`;
        process.env[key] = envUpdates[key];
        updatedKeys.add(key);
      }
    }

    // 追加文件中不存在的新键
    for (const [key, value] of Object.entries(envUpdates)) {
      if (!updatedKeys.has(key)) {
        lines.push(`${key}=${value}`);
        process.env[key] = value;
      }
    }

    // 统一写一次文件
    await fs.writeFile(envPath, lines.join('\n'), 'utf-8');
    res.json({ message: '设置已保存并热加载，立即生效' });
  } catch (error: any) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '保存设置失败' });
  }
});

// ============================================================
// 邮件模板读取/保存（存储在 config/email-template.json）
// ============================================================
const TEMPLATE_FILE = 'config/email-template.json';

const DEFAULT_TEMPLATE = {
  subject: '【Minecraft Skin Server】请验证你的邮箱',
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>邮箱验证 - Minecraft Skin Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 40px auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; color: #58a6ff; }
    .btn { display: inline-block; padding: 12px 28px; background: #238636; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .btn:hover { background: #2ea043; }
    .footer { margin-top: 24px; font-size: 12px; color: #8b949e; text-align: center; }
    .code { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; color: #58a6ff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎮 Minecraft Skin Server</h1>
    </div>
    <p>你好 {{EMAIL}}，</p>
    <p>我们收到了你的邮箱验证请求。请点击下面的按钮完成验证：</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="{{VERIFY_URL}}" class="btn">立即验证邮箱</a>
    </p>
    <p>或者，复制以下链接到浏览器地址栏：</p>
    <div class="code">{{VERIFY_URL}}</div>
    <p style="font-size:13px;color:#8b949e;margin-top:20px;">此链接 30 分钟内有效。如果你没有请求验证，请忽略此邮件。</p>
    <div class="footer">Minecraft Skin Server &copy; {{YEAR}}</div>
  </div>
</body>
</html>`,
};

async function loadTemplateFile() {
  const fs = require('fs/promises');
  const path = require('path');
  const fp = path.resolve(process.cwd(), TEMPLATE_FILE);
  try {
    const content = await fs.readFile(fp, 'utf-8');
    return JSON.parse(content);
  } catch {
    // 文件不存在，创建默认模板
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(DEFAULT_TEMPLATE, null, 2), 'utf-8');
    return { ...DEFAULT_TEMPLATE };
  }
}

/**
 * GET /api/admin/email-template
 * 读取邮件模板
 */
router.get('/email-template', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const template = await loadTemplateFile();
    res.json(template);
  } catch (error: any) {
    console.error('Read email template error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '读取邮件模板失败' });
  }
});

/**
 * PUT /api/admin/email-template
 * 保存邮件模板
 */
router.put('/email-template', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { subject, html } = req.body;
    if (!subject || !html) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: 'subject 和 html 不能为空' });
    }
    const sanitizedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
      .replace(/javascript\s*:/gi, '');
    const fs = require('fs/promises');
    const path = require('path');
    const fp = path.resolve(process.cwd(), TEMPLATE_FILE);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify({ subject, html: sanitizedHtml }, null, 2), 'utf-8');
    res.json({ message: '邮件模板已保存' });
  } catch (error: any) {
    console.error('Save email template error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '保存邮件模板失败' });
  }
});

/**
 * POST /api/admin/test-smtp
 * 测试 SMTP 连接（管理员）
 */
router.post('/test-smtp', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');

    const envSettings: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      envSettings[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }

    const host = envSettings['SMTP_HOST'] || '';
    const port = parseInt(envSettings['SMTP_PORT'] || '587');
    const secure = envSettings['SMTP_SECURE'] === 'true';
    const user = envSettings['SMTP_USER'] || '';
    const pass = envSettings['SMTP_PASS'] || '';

    if (!host || !user || !pass) {
      return res.status(400).json({ success: false, error: 'SMTP 配置不完整，请先填写 SMTP 设置' });
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();
    res.json({ success: true, message: 'SMTP 连接成功！' });
  } catch (error: any) {
    console.error('SMTP 测试失败:', error);
    let errorMsg = error.message || '未知错误';
    if (error.code === 'EAUTH') errorMsg = 'SMTP 认证失败：用户名或授权密码错误';
    if (error.code === 'ESOCKET') errorMsg = '无法连接 SMTP 服务器：请检查 host/端口/网络';
    if (error.code === 'ETIMEDOUT') errorMsg = '连接 SMTP 服务器超时';
    if (error.code === 'ECONNECTION') errorMsg = '连接被拒绝：请检查端口和防火墙设置';
    res.status(500).json({ success: false, error: errorMsg, code: error.code });
  }
});

// ============================================================
// 黑名单管理 API
// ============================================================

/**
 * 获取黑名单列表
 * GET /api/admin/blacklist
 */
router.get('/blacklist', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const blacklist = await BlacklistModel.findAll();
    res.json(blacklist);
  } catch (error) {
    next(error);
  }
});

/**
 * 添加到黑名单
 * POST /api/admin/blacklist
 * body: { email?: string, ip_address?: string, ban_type: 'permanent' | 'temporary', ban_until?: string, reason?: string }
 */
router.post('/blacklist', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, ip_address, ban_type, ban_until, reason } = req.body;
    const currentUser = (req as any).user;

    // 验证参数
    if (!email && !ip_address) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '邮箱和 IP 地址至少提供一个' });
    }

    if (!['permanent', 'temporary'].includes(ban_type)) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '无效的封禁类型' });
    }

    if (ban_type === 'temporary' && !ban_until) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '临时封禁必须提供封禁截止时间' });
    }

    // 检查是否已存在
    if (email) {
      const existing = await BlacklistModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', errorMessage: '该邮箱已在黑名单中' });
      }
    }

    if (ip_address) {
      const existing = await BlacklistModel.findByIP(ip_address);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', errorMessage: '该 IP 已在黑名单中' });
      }
    }

    const entry = await BlacklistModel.create({
      email: email || undefined,
      ip_address: ip_address || undefined,
      ban_type,
      ban_until: ban_until || undefined,
      reason: reason || undefined,
      banned_by: currentUser.id,
    });

    res.status(201).json({ message: '已添加到黑名单', entry });
  } catch (error) {
    next(error);
  }
});

/**
 * 从黑名单删除
 * DELETE /api/admin/blacklist/:id
 */
router.delete('/blacklist/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const entry = await BlacklistModel.findById(parseInt(id));
    if (!entry) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '黑名单记录不存在' });
    }

    await BlacklistModel.delete(parseInt(id));

    res.json({ message: '已从黑名单移除' });
  } catch (error) {
    next(error);
  }
});

/**
 * 清理过期临时封禁记录
 * POST /api/admin/blacklist/cleanup
 */
router.post('/blacklist/cleanup', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedCount = await BlacklistModel.cleanupExpired();
    res.json({ message: `已清理 ${deletedCount} 条过期记录`, deletedCount });
  } catch (error) {
    next(error);
  }
});

/**
 * 手动验证用户邮箱
 * PUT /api/admin/users/:id/verify-email
 */
router.put('/users/:id/verify-email', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '用户不存在' });
    }

    // 已验证则无需操作
    if (user.email_verified) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '该用户邮箱已验证' });
    }

    await DB.query('UPDATE users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    res.json({ message: '邮箱已手动验证' });
  } catch (error) {
    next(error);
  }
});

/**
 * 发送验证邮件
 * POST /api/admin/users/:id/send-verification
 */
router.post('/users/:id/send-verification', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '用户不存在' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '该用户邮箱已验证' });
    }

    // 发送验证邮件（内部会生成 token 并保存）
    const result = await sendVerificationEmail(user.email);

    if (!result.success) {
      return res.status(500).json({ error: 'EmailSendFailed', errorMessage: result.error || '发送验证邮件失败' });
    }

    res.json({ message: '验证邮件已发送' });
  } catch (error) {
    next(error);
  }
});

// 主题图片独立存储配置（4个独立目录，互不干扰）
function makeThemeStorage(subDir: string) {
  return multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const uploadDir = path.resolve(process.cwd(), 'public', 'uploads', 'theme', subDir);
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `theme-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      cb(null, name);
    },
  });
}

const uploadThemeLightBg = multer({ storage: makeThemeStorage('light-bg'), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_BG_EXTS.includes(ext));
} });
const uploadThemeDarkBg = multer({ storage: makeThemeStorage('dark-bg'), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_BG_EXTS.includes(ext));
} });
const uploadThemeLoginBg = multer({ storage: makeThemeStorage('login-bg'), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_BG_EXTS.includes(ext));
} });
const uploadThemeLoginEmbed = multer({ storage: makeThemeStorage('login-embed'), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_BG_EXTS.includes(ext));
} });

// 主题图片类型 → .env 键名 映射
const THEME_IMAGE_ENV_KEY: Record<string, string> = {
  'light-bg': 'LIGHT_BG_IMAGE',
  'dark-bg': 'DARK_BG_IMAGE',
  'login-bg': 'LOGIN_BG_IMAGE',
  'login-embed': 'LOGIN_EMBED_IMAGE',
};

/**
 * POST /api/admin/upload-theme-image?type=light-bg|dark-bg|login-bg|login-embed
 * 上传主题图片到独立目录，上传前删除旧文件
 */
router.post('/upload-theme-image', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const type = req.query.type as string;
  if (!THEME_IMAGE_ENV_KEY[type]) {
    return res.status(400).json({ error: 'BadRequest', errorMessage: '无效的 type 参数，必须是 light-bg、dark-bg、login-bg、login-embed 之一' });
  }

  // 根据 type 选择对应的 multer 中间件
  const uploader =
    type === 'light-bg' ? uploadThemeLightBg :
    type === 'dark-bg' ? uploadThemeDarkBg :
    type === 'login-bg' ? uploadThemeLoginBg :
    uploadThemeLoginEmbed;

  const fieldName = 'image'; // 前端统一用 image 字段名

  uploader.single(fieldName)(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'FileTooLarge', errorMessage: '文件大小超过限制（最大 50MB）' });
      }
      return res.status(400).json({ error: 'UploadError', errorMessage: err.message });
    }
    if (err) {
      return res.status(400).json({ error: 'UploadError', errorMessage: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '未上传文件' });
    }

    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const relativePath = `/uploads/theme/${type}/${req.file.filename}`;
      const fullUrl = `${baseUrl}${relativePath}`;
      const envKey = THEME_IMAGE_ENV_KEY[type];

      // 读取当前 .env，删除旧文件
      const envPath = path.resolve(process.cwd(), '.env');
      const content = await fs.readFile(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${envKey}=`)) {
          const oldValue = trimmed.substring(trimmed.indexOf('=') + 1).trim();
          // 如果是本地上传的文件（路径包含 /uploads/theme/ 或旧路径 /uploads/bg/），则删除旧文件
          if (oldValue && (oldValue.includes('/uploads/theme/') || oldValue.includes('/uploads/bg/'))) {
            // 正确解析文件路径：提取 /uploads/ 之后的相对路径，避免 Windows 上将 /uploads/ 误判为绝对路径
            const urlPath = oldValue.substring(oldValue.indexOf('/uploads/'));
            const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
            const oldFilePath = path.resolve(process.cwd(), 'public', relativePath);
            await fs.unlink(oldFilePath).catch(() => {});
          }
          break;
        }
      }

      // 更新 .env
      let updated = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith(`${envKey}=`)) {
          lines[i] = `${envKey}=${fullUrl}`;
          process.env[envKey] = fullUrl;
          updated = true;
          break;
        }
      }
      if (!updated) {
        lines.push(`${envKey}=${fullUrl}`);
        process.env[envKey] = fullUrl;
      }

      await fs.writeFile(envPath, lines.join('\n'), 'utf-8');

      res.json({ message: '主题图片已上传并保存', url: fullUrl });
    } catch (error: any) {
      console.error('Upload theme image error:', error);
      res.status(500).json({ error: 'InternalServerError', errorMessage: '上传失败' });
    }
  });
});

/**
 * DELETE /api/admin/theme-image/:type
 * 删除主题图片文件并清除 .env 对应字段
 */
router.delete('/theme-image/:type', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const type = req.params.type;
    if (!THEME_IMAGE_ENV_KEY[type]) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '无效的 type 参数' });
    }

    const envKey = THEME_IMAGE_ENV_KEY[type];
    const envPath = path.resolve(process.cwd(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    const lines = content.split('\n');
    let oldValue = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${envKey}=`)) {
        oldValue = trimmed.substring(trimmed.indexOf('=') + 1).trim();
        break;
      }
    }

    // 删除本地文件（兼容新路径 /uploads/theme/ 和旧路径 /uploads/bg/）
    if (oldValue && (oldValue.includes('/uploads/theme/') || oldValue.includes('/uploads/bg/'))) {
      const urlPath = oldValue.substring(oldValue.indexOf('/uploads/'));
      const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
      const filePath = path.resolve(process.cwd(), 'public', relativePath);
      await fs.unlink(filePath).catch(() => {});
    }

    // 清除 .env 字段（设为空字符串）
    let updated = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`${envKey}=`)) {
        lines[i] = `${envKey}=`;
        process.env[envKey] = '';
        updated = true;
        break;
      }
    }

    if (updated) {
      await fs.writeFile(envPath, lines.join('\n'), 'utf-8');
    }

    res.json({ message: '主题图片已删除' });
  } catch (error: any) {
    console.error('Delete theme image error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '删除失败' });
  }
});

/**
 * POST /api/admin/upload-bg
 * 上传首页背景图片（管理员）—— 保留兼容旧逻辑
 */
router.post('/upload-bg', requireAuth, requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  uploadBg.single('bgImage')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'FileTooLarge', errorMessage: '文件大小超过限制（最大 50MB）' });
      }
      return res.status(400).json({ error: 'UploadError', errorMessage: err.message });
    }
    if (err) {
      return res.status(400).json({ error: 'UploadError', errorMessage: err.message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '未上传文件' });
    }

    // 构建可访问的URL路径
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const relativePath = `/uploads/bg/homepage/${req.file.filename}`;
    const fullUrl = `${baseUrl}${relativePath}`;

    // 自动更新环境变量中的背景图片设置
    const fs = await import('fs/promises');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    const lines = content.split('\n');
    const envKey = 'HOMEPAGE_BG_IMAGE';
    let updated = false;
    let oldValue = '';

    // 先读取旧值，供后续删除使用
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${envKey}=`)) {
        oldValue = trimmed.substring(trimmed.indexOf('=') + 1).trim();
        break;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith(`${envKey}=`)) {
        lines[i] = `${envKey}=${fullUrl}`;
        process.env[envKey] = fullUrl;
        updated = true;
        break;
      }
    }

    if (!updated) {
      lines.push(`${envKey}=${fullUrl}`);
      process.env[envKey] = fullUrl;
    }

    await fs.writeFile(envPath, lines.join('\n'), 'utf-8');

    // 删除旧文件（兼容 /uploads/theme/ 和 /uploads/bg/ 路径）
    if (oldValue && (oldValue.includes('/uploads/theme/') || oldValue.includes('/uploads/bg/'))) {
      try {
        const urlPath = oldValue.substring(oldValue.indexOf('/uploads/'));
        const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
        const oldFilePath = path.resolve(process.cwd(), 'public', relativePath);
        await fs.unlink(oldFilePath);
        console.log(`[upload-bg] 已删除旧文件: ${oldFilePath}`);
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          console.warn(`[upload-bg] 删除旧文件失败:`, e.message);
        }
      }
    }

    res.json({
      message: '背景图片已上传并保存',
      url: fullUrl,
    });
  } catch (error: any) {
    console.error('Upload bg error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: '上传失败' });
  }
});



/**
 * 设置皮肤 AI 生成标记（等级 1+ 管理员）
 */
router.post('/skins/:id/ai-generated', requireAuth, requireAdmin, async (req: any, res: any, next: any) => {
  try {
    const adminLevel = req.user.level ?? 0;
    if (adminLevel < 1) return res.status(403).json({ error: 'Forbidden', errorMessage: '需要管理员权限' });
    const isAi = req.body.is_ai_generated === true;
    await SkinModel.setAiGenerated(req.params.id, isAi);
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * 设置皮肤管理员警告（仅等级 2 超级管理员）
 */
router.post('/skins/:id/warning', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const adminLevel = req.user.level ?? 0;
    if (adminLevel < 2) return res.status(403).json({ error: 'Forbidden', errorMessage: '需要超级管理员权限' });
    const warning = req.body.warning;
    if (!warning) return res.status(400).json({ error: 'Bad Request', errorMessage: '警告内容不能为空' });
    await SkinModel.setAdminWarning(req.params.id, warning, adminLevel);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', errorMessage: error.message });
  }
});

/**
 * 移除皮肤管理员警告（等级 >= warning_set_by_level）
 */
router.delete('/skins/:id/warning', requireAuth, requireAdmin, async (req: any, res: any, next: any) => {
  try {
    const adminLevel = req.user.level ?? 0;
    const ok = await SkinModel.removeAdminWarning(req.params.id, adminLevel);
    if (!ok) return res.status(403).json({ error: 'Forbidden', errorMessage: '无权移除该警告' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * 设置披风 AI 生成标记（等级 1+ 管理员）
 */
router.post('/capes/:id/ai-generated', requireAuth, requireAdmin, async (req: any, res: any, next: any) => {
  try {
    const adminLevel = req.user.level ?? 0;
    if (adminLevel < 1) return res.status(403).json({ error: 'Forbidden', errorMessage: '需要管理员权限' });
    const isAi = req.body.is_ai_generated === true;
    await CapeModel.setAiGenerated(req.params.id, isAi);
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * 设置披风管理员警告（仅等级 2 超级管理员）
 */
router.post('/capes/:id/warning', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const adminLevel = req.user.level ?? 0;
    if (adminLevel < 2) return res.status(403).json({ error: 'Forbidden', errorMessage: '需要超级管理员权限' });
    const warning = req.body.warning;
    if (!warning) return res.status(400).json({ error: 'Bad Request', errorMessage: '警告内容不能为空' });
    await CapeModel.setAdminWarning(req.params.id, warning, adminLevel);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', errorMessage: error.message });
  }
});

/**
 * 移除披风管理员警告（等级 >= warning_set_by_level）
 */
router.delete('/capes/:id/warning', requireAuth, requireAdmin, async (req: any, res: any, next: any) => {
  try {
    const adminLevel = req.user.level ?? 0;
    const ok = await CapeModel.removeAdminWarning(req.params.id, adminLevel);
    if (!ok) return res.status(403).json({ error: 'Forbidden', errorMessage: '无权移除该警告' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;

// ============================================================
// 启动迁移：将 bg/ 中的旧文件迁移到分类文件夹
// ============================================================
export async function migrateThemeImages() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    const lines = content.split('\n');
    let changed = false;

    // 迁移主题图片（light-bg, dark-bg, login-bg, login-embed）
    for (const [type, envKey] of Object.entries(THEME_IMAGE_ENV_KEY)) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${envKey}=`)) {
          const value = trimmed.substring(trimmed.indexOf('=') + 1).trim();
          // 只处理指向旧 bg/ 路径的值
          if (value && value.includes('/uploads/bg/') && !value.includes('/uploads/theme/')) {
            const fileName = value.substring(value.lastIndexOf('/') + 1);
            const oldPath = path.resolve(process.cwd(), 'public', 'uploads', 'bg', fileName);
            const newDir = path.resolve(process.cwd(), 'public', 'uploads', 'theme', type);
            await fs.mkdir(newDir, { recursive: true });
            const newPath = path.join(newDir, fileName);
            try {
              await fs.rename(oldPath, newPath);
              const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
              const newUrl = `${baseUrl}/uploads/theme/${type}/${fileName}`;
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith(`${envKey}=`)) {
                  lines[i] = `${envKey}=${newUrl}`;
                  process.env[envKey] = newUrl;
                  break;
                }
              }
              changed = true;
              console.log(`[migrate] ${envKey}: ${fileName} → theme/${type}/`);
            } catch (e: any) {
              // 文件可能不存在，忽略
              if (e.code !== 'ENOENT') {
                console.warn(`[migrate] 迁移失败 ${oldPath}:`, e.message);
              }
            }
          }
          break;
        }
      }
    }

    // 迁移 HOMEPAGE_BG_IMAGE 到 bg/homepage/
    const homepageKey = 'HOMEPAGE_BG_IMAGE';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${homepageKey}=`)) {
        const value = trimmed.substring(trimmed.indexOf('=') + 1).trim();
        if (value && value.includes('/uploads/bg/') && !value.includes('/uploads/bg/homepage/')) {
          const fileName = value.substring(value.lastIndexOf('/') + 1);
          const oldPath = path.resolve(process.cwd(), 'public', 'uploads', 'bg', fileName);
          const newDir = path.resolve(process.cwd(), 'public', 'uploads', 'bg', 'homepage');
          await fs.mkdir(newDir, { recursive: true });
          const newPath = path.join(newDir, fileName);
          try {
            await fs.rename(oldPath, newPath);
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const newUrl = `${baseUrl}/uploads/bg/homepage/${fileName}`;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].trim().startsWith(`${homepageKey}=`)) {
                lines[i] = `${homepageKey}=${newUrl}`;
                process.env[homepageKey] = newUrl;
                break;
              }
            }
            changed = true;
            console.log(`[migrate] ${homepageKey}: ${fileName} → bg/homepage/`);
          } catch (e: any) {
            if (e.code !== 'ENOENT') {
              console.warn(`[migrate] 迁移失败 ${oldPath}:`, e.message);
            }
          }
        }
        break;
      }
    }

    if (changed) {
      await fs.writeFile(envPath, lines.join('\n'), 'utf-8');
      console.log('[migrate] .env 已更新');
    }
  } catch (error: any) {
    console.error('[migrate] 主题图片迁移出错:', error.message);
  }
}


