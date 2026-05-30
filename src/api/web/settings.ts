import { Router, Request, Response } from 'express';
import { SETTINGS_DEFAULTS } from './admin';

const router = Router();

/**
 * GET /api/settings/public
 * 获取公开站点设置（无需认证）
 * 从 .env 文件读取，仅返回安全字段
 */
router.get('/public', async (_req: Request, res: Response) => {
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

    // 仅返回公开安全的设置
    const publicSettings = {
      SITE_TITLE: settings.SITE_TITLE ?? SETTINGS_DEFAULTS.SITE_TITLE,
      SITE_DESCRIPTION: settings.SITE_DESCRIPTION ?? SETTINGS_DEFAULTS.SITE_DESCRIPTION,
      HOMEPAGE_TITLE_TEXT: settings.HOMEPAGE_TITLE_TEXT ?? SETTINGS_DEFAULTS.HOMEPAGE_TITLE_TEXT,
      HOMEPAGE_TEXT: settings.HOMEPAGE_TEXT ?? SETTINGS_DEFAULTS.HOMEPAGE_TEXT,
      HOMEPAGE_BUTTON_TEXT: settings.HOMEPAGE_BUTTON_TEXT ?? SETTINGS_DEFAULTS.HOMEPAGE_BUTTON_TEXT,
      HOMEPAGE_BUTTONS: settings.HOMEPAGE_BUTTONS ?? SETTINGS_DEFAULTS.HOMEPAGE_BUTTONS,
      // 主题设置（向后兼容：DARK_BG_IMAGE 为空时回退到 HOMEPAGE_BG_IMAGE）
      LIGHT_BG_IMAGE: settings.LIGHT_BG_IMAGE ?? SETTINGS_DEFAULTS.LIGHT_BG_IMAGE,
      DARK_BG_IMAGE: settings.DARK_BG_IMAGE ?? settings.HOMEPAGE_BG_IMAGE ?? SETTINGS_DEFAULTS.DARK_BG_IMAGE,
      LIGHT_BG_OVERLAY_OPACITY: settings.LIGHT_BG_OVERLAY_OPACITY ?? SETTINGS_DEFAULTS.LIGHT_BG_OVERLAY_OPACITY,
      DARK_BG_OVERLAY_OPACITY: settings.DARK_BG_OVERLAY_OPACITY ?? SETTINGS_DEFAULTS.DARK_BG_OVERLAY_OPACITY,
      // 登录/注册页面背景图
      LOGIN_BG_IMAGE: settings.LOGIN_BG_IMAGE ?? SETTINGS_DEFAULTS.LOGIN_BG_IMAGE,
      // 登录/注册页面内嵌图片
      LOGIN_EMBED_IMAGE: settings.LOGIN_EMBED_IMAGE ?? SETTINGS_DEFAULTS.LOGIN_EMBED_IMAGE,
      // WebM 视频静音
      VIDEO_MUTED: settings.VIDEO_MUTED ?? SETTINGS_DEFAULTS.VIDEO_MUTED,
      // 网站图标
      SITE_FAVICON: settings.SITE_FAVICON ?? SETTINGS_DEFAULTS.SITE_FAVICON,
      // 版权设置
      COPYRIGHT_TEXT: settings.COPYRIGHT_TEXT ?? SETTINGS_DEFAULTS.COPYRIGHT_TEXT,
      COPYRIGHT_BEIAN: settings.COPYRIGHT_BEIAN ?? SETTINGS_DEFAULTS.COPYRIGHT_BEIAN,
      // 项目版权标识（硬编码，不可通过管理面板更改）
      COPYRIGHT_PROJECT: settings.COPYRIGHT_PROJECT ?? SETTINGS_DEFAULTS.COPYRIGHT_PROJECT,
    };

    res.json(publicSettings);
  } catch (error: any) {
    console.error('Read public settings error:', error);
    res.json({
      SITE_TITLE: SETTINGS_DEFAULTS.SITE_TITLE,
      SITE_DESCRIPTION: SETTINGS_DEFAULTS.SITE_DESCRIPTION,
      HOMEPAGE_TITLE_TEXT: SETTINGS_DEFAULTS.HOMEPAGE_TITLE_TEXT,
      HOMEPAGE_TEXT: SETTINGS_DEFAULTS.HOMEPAGE_TEXT,
      HOMEPAGE_BUTTON_TEXT: SETTINGS_DEFAULTS.HOMEPAGE_BUTTON_TEXT,
      HOMEPAGE_BUTTONS: SETTINGS_DEFAULTS.HOMEPAGE_BUTTONS,
      HOMEPAGE_BG_IMAGE: SETTINGS_DEFAULTS.HOMEPAGE_BG_IMAGE,
      // 主题设置默认值
      LIGHT_BG_IMAGE: SETTINGS_DEFAULTS.LIGHT_BG_IMAGE,
      DARK_BG_IMAGE: SETTINGS_DEFAULTS.DARK_BG_IMAGE,
      LIGHT_BG_OVERLAY_OPACITY: SETTINGS_DEFAULTS.LIGHT_BG_OVERLAY_OPACITY,
      DARK_BG_OVERLAY_OPACITY: SETTINGS_DEFAULTS.DARK_BG_OVERLAY_OPACITY,
      // 登录/注册页面背景图默认值
      LOGIN_BG_IMAGE: SETTINGS_DEFAULTS.LOGIN_BG_IMAGE,
      // 登录/注册页面内嵌图片默认值
      LOGIN_EMBED_IMAGE: SETTINGS_DEFAULTS.LOGIN_EMBED_IMAGE,
      // WebM 视频静音默认值
      VIDEO_MUTED: SETTINGS_DEFAULTS.VIDEO_MUTED,
      // 网站图标默认值
      SITE_FAVICON: SETTINGS_DEFAULTS.SITE_FAVICON,
      // 版权设置默认值
      COPYRIGHT_TEXT: SETTINGS_DEFAULTS.COPYRIGHT_TEXT,
      COPYRIGHT_BEIAN: SETTINGS_DEFAULTS.COPYRIGHT_BEIAN,
      // 项目版权标识（硬编码，不可通过管理面板更改）
      COPYRIGHT_PROJECT: SETTINGS_DEFAULTS.COPYRIGHT_PROJECT,
    });
  }
});

export default router;
