import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { ProfileModel } from '../../models/Profile';
import { SkinModel, Skin } from '../../models/Skin';
import { CapeModel, Cape } from '../../models/Cape';
import { TokenModel } from '../../models/Token';
import { UserModel } from '../../models/User';
import { validateSkin, validateCape, processSkin, calculateFileHash } from '../../utils/image';
import * as fs from 'fs/promises';
import { DB } from '../../config/database';
import { StorageService } from '../../services/StorageService';

const router = Router();

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

const useS3 = StorageService.isS3();

const storage = useS3
  ? multer.memoryStorage()
  : multer.diskStorage({
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

async function cleanupLocalFile(filePath: string) {
  await fs.unlink(filePath).catch(() => {});
}

async function cleanupS3Upload(key: string) {
  await StorageService.deleteFile(key).catch(() => {});
}

/**
 * @openapi
 * /api/user/profile/{uuid}/{textureType}:
 *   put:
 *     tags: [纹理上传]
 *     summary: 上传皮肤/披风
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: 角色UUID
 *       - in: path
 *         name: textureType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [skin, cape]
 *         description: 纹理类型
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PNG格式图片文件
 *               model:
 *                 type: string
 *                 enum: [default, slim]
 *                 description: 皮肤模型类型（仅skin有效）
 *               name:
 *                 type: string
 *                 description: 皮肤/披风名称
 *               description:
 *                 type: string
 *                 description: 皮肤/披风描述
 *     responses:
 *       204:
 *         description: 上传成功
 *       400:
 *         description: 文件格式错误或参数无效
 *       401:
 *         description: 未认证
 *       403:
 *         description: 无权限或邮箱未验证
 */
router.put('/:uuid/:textureType', upload.single('file'), async (req: any, res: Response) => {
  try {
    const { uuid, textureType } = req.params;
    const { model } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (useS3 && req.file) {
        // S3 mode: nothing to clean from memory
      } else if (req.file) {
        await cleanupLocalFile(req.file.path);
      }
      return res.status(401).json({
        error: 'Unauthorized',
        errorMessage: 'Missing or invalid access token',
      });
    }

    const accessToken = authHeader.substring(7);
    const token = await TokenModel.validate(accessToken);
    if (!token) {
      if (!useS3 && req.file) {
        await cleanupLocalFile(req.file.path);
      }
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Invalid token',
      });
    }

    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) {
      if (!useS3 && req.file) {
        await cleanupLocalFile(req.file.path);
      }
      return;
    }

    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      if (!useS3 && req.file) {
        await cleanupLocalFile(req.file.path);
      }
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Profile does not belong to user',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: 'No file uploaded',
      });
    }

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    const subDir = textureType === 'cape' ? 'capes' : 'skins';
    const s3Key = `${subDir}/${uniqueName}`;

    if (useS3) {
      const fileBuffer = req.file.buffer;
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-upload-'));
      const tmpPath = path.join(tmpDir, uniqueName);

      try {
        await fs.writeFile(tmpPath, fileBuffer);

        let validationResult: any;
        if (textureType === 'skin') {
          validationResult = await validateSkin(tmpPath);
        } else if (textureType === 'cape') {
          validationResult = await validateCape(tmpPath);
        } else {
          await fs.rm(tmpDir, { recursive: true }).catch(() => {});
          return res.status(400).json({
            error: 'BadRequest',
            errorMessage: 'Invalid texture type',
          });
        }

        if (!validationResult.valid) {
          await fs.rm(tmpDir, { recursive: true }).catch(() => {});
          return res.status(400).json({
            error: 'BadRequest',
            errorMessage: validationResult.error,
          });
        }

        const processedPath = tmpPath.replace('.png', '_processed.png');
        await processSkin(tmpPath, processedPath);
        await fs.unlink(tmpPath);
        await fs.rename(processedPath, tmpPath);

        const fileHash = await calculateFileHash(tmpPath);

        let existingRecord: Skin | Cape | null = null;
        if (textureType === 'skin') {
          existingRecord = await SkinModel.findByHash(fileHash) as any;
        } else {
          existingRecord = await CapeModel.findByHash(fileHash) as any;
        }

        let finalRecord: Skin | Cape;

        if (!existingRecord) {
          const processedBuffer = await fs.readFile(tmpPath);
          const storedPath = await StorageService.uploadFile(s3Key, processedBuffer, 'image/png');

          try {
            if (textureType === 'skin') {
              finalRecord = await SkinModel.create({
                userId: token.user_id,
                profileId: uuid,
                filePath: storedPath,
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
              finalRecord = await CapeModel.create({
                userId: token.user_id,
                filePath: storedPath,
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
          } catch (dbError) {
            await cleanupS3Upload(s3Key);
            throw dbError;
          }
        } else {
          if (textureType === 'skin') {
            await SkinModel.updateProfileId((existingRecord as Skin).id, uuid);
          }
          finalRecord = existingRecord;
        }

        if (textureType === 'skin') {
          await ProfileModel.updateSkin(uuid, (finalRecord as Skin).id);
        } else if (textureType === 'cape') {
          await ProfileModel.updateCape(uuid, (finalRecord as Cape).id);
        }

        res.status(204).send();
      } finally {
        await fs.rm(tmpDir, { recursive: true }).catch(() => {});
      }
    } else {
      const filePath = req.file.path;

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

      const processedPath = filePath.replace('.png', '_processed.png');
      await processSkin(filePath, processedPath);
      await fs.unlink(filePath);
      await fs.rename(processedPath, filePath);

      const fileHash = await calculateFileHash(filePath);

      let existingRecord: Skin | Cape | null = null;
      if (textureType === 'skin') {
        existingRecord = await SkinModel.findByHash(fileHash) as any;
      } else {
        existingRecord = await CapeModel.findByHash(fileHash) as any;
      }

      let finalRecord: Skin | Cape;

      if (!existingRecord) {
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
        if (textureType === 'skin') {
          await SkinModel.updateProfileId((existingRecord as Skin).id, uuid);
        }
        finalRecord = existingRecord;
      }

      if (textureType === 'skin') {
        await ProfileModel.updateSkin(uuid, (finalRecord as Skin).id);
      } else if (textureType === 'cape') {
        await ProfileModel.updateCape(uuid, (finalRecord as Cape).id);
      }

      res.status(204).send();
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '上传失败',
    });
  }
});

router.post('/:uuid/skin', async (req: any, res: Response) => {
  try {
    const { uuid } = req.params;
    const { skin_id } = req.body;

    if (!skin_id) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '缺少 skin_id 参数',
      });
    }

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

    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) return;

    const skin = await SkinModel.findById(skin_id) as any;
    if (!skin) {
      return res.status(404).json({
        error: 'NotFound',
        errorMessage: '皮肤不存在',
      });
    }

    const isOwner = skin.user_id === token.user_id;
    const isPublic = skin.permission_level === 'public_downloadable';

    const favResult = await DB.query(
      'SELECT 1 FROM skin_favorites WHERE user_id = $1 AND skin_id = $2',
      [token.user_id, skin_id]
    );
    const isFavorited = favResult.rows.length > 0;

    if (!isOwner && !isFavorited && !isPublic) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: '无权使用此皮肤',
      });
    }

    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: '角色不属于当前用户',
      });
    }

    await ProfileModel.updateSkin(uuid, skin_id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Apply skin error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '应用皮肤失败',
    });
  }
});

router.post('/:uuid/cape', async (req: any, res: Response) => {
  try {
    const { uuid } = req.params;
    const { cape_id } = req.body;

    if (!cape_id) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '缺少 cape_id 参数',
      });
    }

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

    const isVerified = await checkEmailVerified(token.user_id, res);
    if (!isVerified) return;

    const cape = await CapeModel.findById(cape_id) as any;
    if (!cape) {
      return res.status(404).json({
        error: 'NotFound',
        errorMessage: '披风不存在',
      });
    }

    const isOwner = cape.user_id === token.user_id;
    const isPublic = cape.permission_level === 'public_downloadable';

    const favResult = await DB.query(
      'SELECT 1 FROM cape_favorites WHERE user_id = $1 AND cape_id = $2',
      [token.user_id, cape_id]
    );
    const isFavorited = favResult.rows.length > 0;

    if (!isOwner && !isFavorited && !isPublic) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: '无权使用此披风',
      });
    }

    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: '角色不属于当前用户',
      });
    }

    await ProfileModel.updateCape(uuid, cape_id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Apply cape error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '应用披风失败',
    });
  }
});

router.delete('/:uuid/skin', async (req: any, res: Response) => {
  try {
    const { uuid } = req.params;

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

    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: '角色不属于当前用户',
      });
    }

    await ProfileModel.updateSkin(uuid, null);
    res.status(204).send();
  } catch (error: any) {
    console.error('Remove skin error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '移除皮肤失败',
    });
  }
});

router.delete('/:uuid/cape', async (req: any, res: Response) => {
  try {
    const { uuid } = req.params;

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

    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: '角色不属于当前用户',
      });
    }

    await ProfileModel.updateCape(uuid, null);
    res.status(204).send();
  } catch (error: any) {
    console.error('Remove cape error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '移除披风失败',
    });
  }
});

export default router;
