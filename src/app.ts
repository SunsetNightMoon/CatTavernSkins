import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { loadPublicKey } from './utils/crypto';
import { swaggerSpec } from './config/swagger';
import { StorageService } from './services/StorageService';
import { getStorageConfig } from './config/storage';
import { S3Client, S3ClientConfig, GetObjectCommand } from '@aws-sdk/client-s3';

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
import oauthRoutes from './api/web/oauth';

const app: Express = express();

// 信任反向代理（修复 LOW：req.ip 在反向代理后取真实客户端 IP，并使 secure cookie 正确生效）
// 必须在限流器 / helmet 之前设置，限流与安全中间件才能看到正确的客户端 IP。
app.set('trust proxy', 1);

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
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://challenges.cloudflare.com",
        ...(process.env.ENABLE_SWAGGER === 'true' ? ["https://cdn.jsdelivr.net"] : []),
      ],
      scriptSrc: [
        "'self'",
        "https://challenges.cloudflare.com",
      ],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: [
        "'self'",
        ...(process.env.ENABLE_SWAGGER === 'true' ? ["https://cdn.jsdelivr.net"] : []),
      ],
      frameSrc: ["https://challenges.cloudflare.com"],
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
app.use(cookieParser());

// Cookie → Authorization 桥接中间件（修复 H1）。
// 必须在 cookieParser() 之后、所有路由 / 安装守卫之前运行。
// 若请求没有有效的 Authorization 头但携带 auth_token cookie（httpOnly，不可被 JS 读取），
// 则合成 `Bearer <cookie>` 头，使所有现有基于 Bearer 的路由（含 Yggdrasil）透明地支持 Cookie，
// 同时保留显式有效 Authorization 头优先的行为。
//
// 注意「无效头」的判定：H1 后前端 token 不再持久化到 localStorage，部分历史代码
// 仍从 localStorage 读取并显式发送 `Authorization: Bearer null`（或 `Bearer undefined`、
// 空 Bearer）。这类假头会顶掉 cookie 导致鉴权失败。此处将其视为「无有效头」，
// 回退到 cookie，从而无需逐一改动数十处前端调用点。
app.use((req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const headerIsValid = headerToken !== '' && headerToken !== 'null' && headerToken !== 'undefined';

  if (!headerIsValid && req.cookies?.auth_token) {
    req.headers.authorization = `Bearer ${req.cookies.auth_token}`;
  }
  next();
});

// 静态文件服务（皮肤文件访问）
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const useS3 = StorageService.isS3();

// /uploads/:subdir/:filename 代理路由允许的子目录白名单。
// 仅纹理（皮肤/披风）通过该 2 段式路由提供；主题/背景等管理媒体走更深的本地路径
// （/uploads/theme/<type>/<file>、/uploads/bg/homepage/<file>，且始终写入本地 public/uploads），
// 不会命中此路由。
const ALLOWED_UPLOAD_SUBDIRS = new Set(['skins', 'capes']);
// 保守的安全文件名模式：纹理为 png，管理媒体可能含 mp4/webm/jpg 等。
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp|gif|mp4|webm)$/;

if (useS3) {
  const s3Config = getStorageConfig().s3;
  // 与 StorageService 保持一致：仅在配置了自定义 endpoint（MinIO 等）时设置
  // endpoint + forcePathStyle；真实 AWS S3 使用 SDK 默认 endpoint 与虚拟主机寻址。
  const s3ClientConfig: S3ClientConfig = {
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
    },
  };
  if (s3Config.endpoint) {
    s3ClientConfig.endpoint = s3Config.endpoint;
    s3ClientConfig.forcePathStyle = true;
  }
  const s3Client = new S3Client(s3ClientConfig);

  app.get('/uploads/:subdir/:filename', async (req: Request, res: Response) => {
    const { subdir, filename } = req.params;

    // 输入硬化（在触碰 S3 之前完成）：
    // 1) 子目录必须在白名单内。
    if (!ALLOWED_UPLOAD_SUBDIRS.has(subdir)) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '文件不存在' });
    }
    // 2) 文件名必须匹配严格安全模式，且不含路径分隔符 / 遍历序列（含 URL 编码形式）。
    const lowerFilename = filename.toLowerCase();
    if (
      !SAFE_FILENAME_RE.test(filename) ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      lowerFilename.includes('%2e') ||
      lowerFilename.includes('%2f') ||
      lowerFilename.includes('%5c')
    ) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '非法文件名' });
    }

    const key = `${subdir}/${filename}`;
    // 3) 解码后的防遍历兜底校验。
    if (key.includes('..') || key.startsWith('/')) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '非法路径' });
    }

    // 只读公开静态资源（无凭据/Cookie），统一使用 ACAO: * 而非反射任意 Origin。
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    try {
      if (s3Config.publicUrl) {
        return res.redirect(`${s3Config.publicUrl}/${key}`);
      }

      const result = await s3Client.send(new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      }));

      if (result.ContentType) {
        res.setHeader('Content-Type', result.ContentType);
      }
      if (result.ContentLength) {
        res.setHeader('Content-Length', result.ContentLength);
      }
      if (result.Body) {
        const body = result.Body as any;
        // 处理流中途错误（头部已发送后 S3 出错不应使进程崩溃）。
        body.on('error', (streamErr: Error) => {
          console.error('S3 stream error:', streamErr);
          if (!res.headersSent) {
            res.status(500).json({ error: 'InternalServerError', errorMessage: '读取文件失败' });
          } else {
            res.destroy(streamErr);
          }
        });
        // 处理客户端中断：及时销毁底层流，释放资源。
        res.on('close', () => {
          if (typeof body.destroy === 'function') {
            body.destroy();
          }
        });
        body.pipe(res);
      } else {
        res.status(404).json({ error: 'NotFound', errorMessage: '文件不存在' });
      }
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        res.status(404).json({ error: 'NotFound', errorMessage: '文件不存在' });
      } else {
        console.error('S3 proxy error:', error);
        res.status(500).json({ error: 'InternalServerError', errorMessage: '读取文件失败' });
      }
    }
  });
} else {
  app.use('/uploads', (_req: Request, res: Response, next: NextFunction) => {
    // 只读公开静态资源（无凭据/Cookie），统一使用 ACAO: * 而非反射任意 Origin。
    res.setHeader('Access-Control-Allow-Origin', '*');
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
}

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

// Swagger API 文档
if (process.env.ENABLE_SWAGGER === 'true') {
  const swaggerUi = require('swagger-ui-express');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec);
  });
}

// Yggdrasil API 路由
app.use('/authserver', authserverRoutes);
app.use('/sessionserver', sessionserverRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/user/profile', textureRoutes);

// Web管理API路由
app.use('/api/auth', webAuthRoutes);
app.use('/api/auth/oauth', oauthRoutes);
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
