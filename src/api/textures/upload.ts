import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { ProfileModel } from '../../models/Profile';
import { SkinModel, Skin } from '../../models/Skin';
import { CapeModel, Cape } from '../../models/Cape';
import { TokenModel } from '../../models/Token';
import { UserModel } from '../../models/User';
import { validateSkin, validateCape, processSkin, calculateFileHash } from '../../utils/image';
import * as fs from 'fs/promises';

const router = Router();

/**
 * 辅助函数：检查用户邮箱是否已验证（未验证则返回403）
 */
async function checkEmailVerified(userId: string, res: Response): Promise<boolean> {
  const user = await UserModel.findById(userId);
  if (!user || user.email_verified !== 1) {
    res.status(403).json({
      error: 'Forbidden',
      errorMessage: '请先验证邮箱后再使用此功能',
    });
    return false;
  }
  return true;
}

// 配置上传
const storage = multer.diskStorage({
  destination: async (req: any, _file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const textureType = req.params.textureType;
    const subDir = textureType === 'cape' ? 'capes' : 'skins';
    const fullPath = path.join(uploadDir, subDir);
    
    await fs.mkdir(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: (_req, _file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '2097152'),
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('只支持PNG格式'));
    }
  },
});

/**
 * PUT /api/user/profile/:uuid/:textureType
 * 上传皮肤/披风
 */
router.put('/:uuid/:textureType', upload.single('file'), async (req: any, res: Response) => {
  try {
    const { uuid, textureType } = req.params;
    const { model } = req.body;

    // 验证access_token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: 'Missing or invalid access token',
      });
    }

    const accessToken = authHeader.substring(7);
    const token = await TokenModel.validate(accessToken);
    if (!token) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Invalid token',
      });
    }

    // 检查邮箱验证状态（上传皮肤/披风需要验证邮箱）
    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return;
    }

    // 验证角色是否属于该用户
    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Profile does not belong to user',
      });
    }

    // 验证上传的文件
    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: 'No file uploaded',
      });
    }

    const filePath = req.file.path;

    // 验证皮肤/披风格式
    let validationResult: any;
    if (textureType === 'skin') {
      validationResult = await validateSkin(filePath);
    } else if (textureType === 'cape') {
      validationResult = await validateCape(filePath);
    } else {
      await fs.unlink(filePath);
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: 'Invalid texture type',
      });
    }

    if (!validationResult.valid) {
      await fs.unlink(filePath);
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: validationResult.error,
      });
    }

    // 处理图片（移除元数据）
    const processedPath = filePath.replace('.png', '_processed.png');
    await processSkin(filePath, processedPath);
    await fs.unlink(filePath); // 删除原始文件
    await fs.rename(processedPath, filePath); // 用处理后的文件替换

    // 计算文件哈希
    const fileHash = await calculateFileHash(filePath);

    // 检查是否已存在相同文件（去重）—— 根据类型分别处理
    let existingRecord: Skin | Cape | null = null;
    if (textureType === 'skin') {
      existingRecord = await SkinModel.findByHash(fileHash) as any;
    } else {
      existingRecord = await CapeModel.findByHash(fileHash) as any;
    }

    let finalRecord: Skin | Cape;

    if (!existingRecord) {
      // 创建新记录
      if (textureType === 'skin') {
        finalRecord = await SkinModel.create({
          userId: token.user_id,
          profileId: uuid,
          filePath: filePath,
          modelType: model === 'slim' ? 'slim' : 'default',
          fileHash: fileHash,
          fileSize: req.file.size,
          width: validationResult.width,
          height: validationResult.height,
          name: req.body.name || undefined,
          description: req.body.description || undefined,
          licenseType: 'ARR',
          permissionLevel: 'private',
        }) as any;
      } else {
        // 披风上传
        finalRecord = await CapeModel.create({
          userId: token.user_id,
          filePath: filePath,
          fileHash: fileHash,
          fileSize: req.file.size,
          width: validationResult.width || 22,
          height: validationResult.height || 17,
          name: req.body.name || undefined,
          description: req.body.description || undefined,
          licenseType: req.body.licenseType || 'ARR',
          permissionLevel: req.body.permissionLevel || 'private',
        }) as any;
      }
    } else {
      // 使用已存在的记录（去重）
      if (textureType === 'skin') {
        await SkinModel.updateProfileId((existingRecord as Skin).id, uuid);
      }
      // 披风无 profile_id 字段，无需更新
      finalRecord = existingRecord;
    }

    // 更新角色的激活皮肤/披风
    if (textureType === 'skin') {
      await ProfileModel.updateSkin(uuid, (finalRecord as Skin).id);
    } else if (textureType === 'cape') {
      await ProfileModel.updateCape(uuid, (finalRecord as Cape).id);
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '上传失败',
    });
  }
});

export default router;
