import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs/promises';
import { SkinModel } from '../../models/Skin';
import { CapeModel } from '../../models/Cape';
import { ProfileModel } from '../../models/Profile';
import { TokenModel } from '../../models/Token';
import { UserModel } from '../../models/User';
import { FavoriteModel } from '../../models/Favorite';
import { calculateFileHash } from '../../utils/image';

const router = Router();

/**
 * 辅助函数：检查用户邮箱是否已验证（未验证则返回403）
 */
async function checkEmailVerified(userId: string, res: Response): Promise<boolean> {
  const user = await UserModel.findById(userId);
  if (!user || !user.email_verified) {
    res.status(403).json({
      error: 'Forbidden',
      errorMessage: '请先验证邮箱后再使用此功能',
    });
    return false;
  }
  return true;
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/skins');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(new Error('只支持 PNG 格式'));
  },
});

/**
 * GET /api/skins
 * 获取用户的皮肤列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 验证access_token
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
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Invalid token',
      });
    }

    // 获取用户的皮肤列表
    const skins = await SkinModel.findByUserId(token.user_id);

    res.json(skins.map(s => ({
      id: s.id,
      file_path: s.file_path?.replace(/^\.\//, '/'),
      model_type: s.model_type,
      name: s.name,
      description: s.description,
      license_type: s.license_type,
      permission_level: s.permission_level,
      approval_status: s.approval_status,
      download_count: s.download_count,
      view_count: s.view_count,
      created_at: s.created_at,
    })));
  } catch (error: any) {
    console.error('Get skins error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '获取皮肤列表失败',
    });
  }
});

// 披风上传配置（复用皮肤上传的 storage/dest，只改目录）
const capeStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/capes');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    cb(null, uniqueName);
  },
});
const uploadCape = multer({
  storage: capeStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 披风 ≤1MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(new Error('只支持 PNG 格式'));
  },
});

/**
 * POST /api/skins/upload-cape
 * 上传披风文件
 */
router.post('/upload-cape', uploadCape.single('cape'), async (req: any, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = await TokenModel.validate(authHeader.substring(7));
    if (!token) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'Forbidden', errorMessage: 'Token 无效' });
    }

    // 检查邮箱验证状态
    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请选择披风文件' });
    }

    const { name: cape_name = '', description = '', license_type = 'ARR', permission_level = 'private' } = req.body;

    if (!cape_name.trim()) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请输入披风名称' });
    }

    // 披风相对路径，前端通过 /uploads/capes/xxx.png 访问
    const capeUrl = '/uploads/capes/' + req.file.filename;
    const filePath = './' + path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');

    // 计算文件哈希（用于去重）
    const fileHash = await calculateFileHash(req.file.path);

    const cape = await CapeModel.create({
      userId: token.user_id,
      filePath,
      fileHash,
      fileSize: req.file.size,
      name: cape_name.trim(),
      description,
      licenseType: license_type,
      permissionLevel: permission_level,
    });

    res.status(201).json({ message: '披风上传成功', capeId: cape.id, capeUrl });
  } catch (error: any) {
    console.error('Upload cape error:', error);
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message || '披风上传失败' });
  }
});

/**
 * POST /api/skins/upload
 * 上传皮肤文件
 */
router.post('/upload', upload.single('skin'), async (req: any, res: Response) => {
  try {
    // 验证 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = await TokenModel.validate(authHeader.substring(7));
    if (!token) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'Forbidden', errorMessage: 'Token 无效' });
    }

    // 检查邮箱验证状态
    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请选择皮肤文件' });
    }

    const { name: skin_name = '', model_type = 'default', description = '', license_type, permission_level = 'private' } = req.body;

    if (!license_type) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请选择协议类型' });
    }
    if (!skin_name.trim()) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'BadRequest', errorMessage: '请输入皮肤名称' });
    }

    const { calculateFileHash } = await import('../../utils/image');
    const fileHash = await calculateFileHash(req.file.path);

    // 检查是否已存在相同皮肤
    const existing = await SkinModel.findByHash(fileHash);
    if (existing && existing.user_id === token.user_id) {
      await fs.unlink(req.file.path);
      return res.status(409).json({ error: 'Conflict', errorMessage: '该皮肤已上传过' });
    }

    const skin = await SkinModel.create({
      userId: token.user_id,
      filePath: './' + path.relative(process.cwd(), req.file.path).replace(/\\/g, '/'),
      modelType: model_type === 'slim' ? 'slim' : 'default',
      fileHash,
      fileSize: req.file.size,
      width: 64,
      height: 64,
      name: skin_name.trim(),
      description,
      licenseType: license_type,
      permissionLevel: permission_level,
    });

    res.status(201).json({ message: '上传成功', skinId: skin.id });
  } catch (error: any) {
    console.error('Upload error:', error);
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message || '上传失败' });
  }
});

/**
 * POST /api/skins/:skinId/activate/:uuid
 * 激活皮肤到指定角色
 */
router.post('/:skinId/activate/:uuid', async (req: Request, res: Response) => {
  try {
    const { skinId, uuid } = req.params;

    // 验证access_token
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
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Invalid token',
      });
    }

    // 检查邮箱验证状态（使用皮肤功能需要验证邮箱）
    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) return;

    // 验证皮肤是否存在
    const skin = await SkinModel.findById(skinId);
    if (!skin) {
      return res.status(404).json({
        error: 'NotFound',
        errorMessage: 'Skin not found',
      });
    }

    // 允许应用：自己上传的 / 收藏的 / 公开可下载的
    const isOwner = skin.user_id === token.user_id;
    const isFavorited = await FavoriteModel.isSkinFavorited(token.user_id, skinId);
    const isPublicDownloadable = skin.permission_level === 'public_downloadable';
    if (!isOwner && !isFavorited && !isPublicDownloadable) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Skin does not belong to user',
      });
    }

    // 验证角色是否属于该用户
    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Profile does not belong to user',
      });
    }

    // 更新角色的激活皮肤
    await ProfileModel.updateSkin(uuid, skinId);

    res.status(204).send();
  } catch (error: any) {
    console.error('Activate skin error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '激活皮肤失败',
    });
  }
});

/**
 * PUT /api/skins/:skinId
 * 更新皮肤信息（仅自己的皮肤）
 */
router.put('/:skinId', async (req: any, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }
    const token = await TokenModel.validate(authHeader.substring(7));
    if (!token) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: 'Token 无效' });
    }

    const { skinId } = req.params;
    const { name, description, license_type, permission_level } = req.body;

    const skin = await SkinModel.findById(skinId);
    if (!skin || skin.user_id !== token.user_id) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: '无权操作此皮肤' });
    }

    await SkinModel.updateInfo(skinId, { name, description, license_type, permission_level });
    res.json({ message: '皮肤信息已更新' });
  } catch (error: any) {
    console.error('Update skin error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message || '更新失败' });
  }
});

/**
 * DELETE /api/skins/:skinId
 * 删除皮肤
 */
router.delete('/:skinId', async (req: Request, res: Response) => {
  try {
    const { skinId } = req.params;

    // 验证access_token
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
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Invalid token',
      });
    }

    // 验证皮肤是否属于该用户
    const skin = await SkinModel.findById(skinId);
    if (!skin || skin.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Skin does not belong to user',
      });
    }

    // 删除皮肤
    await SkinModel.delete(skinId);

    res.status(204).send();
  } catch (error: any) {
    console.error('Delete skin error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '删除皮肤失败',
    });
  }
});

export default router;
