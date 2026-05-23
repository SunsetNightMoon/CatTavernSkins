import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { loadPublicKey } from './utils/crypto';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 导入路由
import authserverRoutes from './api/authserver/authenticate';
import sessionserverRoutes from './api/sessionserver/join';
import profileRoutes from './api/sessionserver/profile';
import textureRoutes from './api/textures/upload';
import webAuthRoutes from './api/web/auth';
import webProfilesRoutes from './api/web/profiles';
import webSkinsRoutes from './api/web/skins';
import webCapesRoutes from './api/web/capes';
import setupRoutes from './api/web/setup';
import captchaRoutes from './api/web/captcha';
import libraryRoutes from './api/web/library';
import favoritesRoutes from './api/web/favorites';
import adminRoutes from './api/web/admin';
import settingsRoutes from './api/web/settings';

const app: Express = express();

// CORS配置（必须在 helmet 之前，以便 helmet 看到正确的 CORS 配置）
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.BASE_URL
    : true,
  credentials: true,
}));

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（皮肤文件访问）
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
  // 允许跨域读取皮肤图片（canvas getImageData 需要）
  // 注意：不能同时设置 Allow-Origin: * 和 Allow-Credentials: true
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.resolve(uploadDir), {
  setHeaders: (res, filePath) => {
    if (filePath.toLowerCase().endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.toLowerCase().endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    }
  },
}),
// 同时服务 public/uploads（背景图上传目录）
express.static(path.resolve('public/uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.toLowerCase().endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.toLowerCase().endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    }
  },
})
);

// 请求日志（开发环境）
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// 健康检查（不受安装守卫限制）
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ========== 生产环境：直接提供前端静态文件 ==========
const isProduction = process.env.NODE_ENV === 'production';
const frontendDistPath = path.join(__dirname, '../frontend/dist');

if (isProduction) {
  // 提供前端静态文件（js/css/images 等）
  app.use(express.static(frontendDistPath, {
    setHeaders: (res, filePath) => {
      // 确保 .html 文件不被缓存（方便更新）
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
}

// 安装守卫中间件：未安装时只允许访问 /api/setup 和 /health
app.use(async (req: Request, res: Response, next: NextFunction) => {
  // 跳过安装相关请求
  if (req.path.startsWith('/api/setup') || req.path === '/health') {
    return next();
  }

  try {
    const { SetupService } = await import('./services/SetupService');
    const isSetup = await SetupService.isSetupCompleted();
    if (!isSetup) {
      // API 请求返回 JSON 错误
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          error: 'SetupRequired',
          message: '请先完成安装',
          setup_url: '/setup'
        });
      }
      // 页面请求重定向到安装页
      return res.redirect('/setup');
    }
  } catch (error) {
    console.error('[Setup Guard] 检查失败:', error);
  }
  next();
});

// Yggdrasil API 路由
app.use('/authserver', authserverRoutes);
app.use('/sessionserver', sessionserverRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/user/profile', textureRoutes);

// Web管理API路由
app.use('/api/auth', webAuthRoutes);
app.use('/api/me/profiles', webProfilesRoutes);  // Web 个人资料 API，避免与 Yggdrasil 冲突
app.use('/api/skins', webSkinsRoutes);
app.use('/api/capes', webCapesRoutes);

// 新功能路由
app.use('/api/setup', setupRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/library', libraryRoutes);

// 收藏路由（必须在 /api/skins 和 /api/capes 之前注册）
app.use('/api', favoritesRoutes);

// 公开站点设置（无需认证，必须在 /api/admin 之前挂载）
app.use('/api/settings', settingsRoutes);

// 管理员 API 路由
app.use('/api/admin', adminRoutes);

// Yggdrasil 元数据响应构建器
async function buildYggdrasilMeta() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const skinDomain = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return 'localhost';
    }
  })();

  const meta = {
    meta: {
      serverName: 'Minecraft Skin Server',
      implementationName: 'minecraft-skin-server',
      implementationVersion: '2.0.0',
      links: {
        homepage: baseUrl,
        register: `${baseUrl}/register`,
      },
      'feature.non_email_login': true,
    },
    skinDomains: [skinDomain],
    uploadableTextures: ['skin', 'cape'],  // Yggdrasil spec Section 3.1.3
  };

  try {
    const publicKey = await loadPublicKey();
    return { ...meta, signaturePublickey: publicKey };
  } catch {
    return meta;
  }
}

// 元数据API（根路径）
// 生产环境下由 SPA fallback 返回 index.html，开发环境下返回元数据
app.get('/', async (_req: Request, res: Response) => {
  if (isProduction) {
    // 生产环境：返回前端页面（让 SPA 路由处理）
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
  res.json(await buildYggdrasilMeta());
});

// 元数据API（/api/yggdrasil，PCL2/HMCL 常用路径）
app.get('/api/yggdrasil', async (_req: Request, res: Response) => {
  res.json(await buildYggdrasilMeta());
});

// ========== SPA fallback（生产环境）==========
if (isProduction) {
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // API 请求未匹配：交给 404 处理
    if (req.path.startsWith('/api/')) {
      return next();
    }
    // 非 API 请求：返回 index.html（SPA 路由）
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 404处理
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    errorMessage: '请求的资源不存在',
  });
});

// 错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('服务器错误:', err);
  
  res.status(500).json({
    error: 'InternalServerError',
    errorMessage: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message,
  });
});

export default app;
