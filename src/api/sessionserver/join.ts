import { Router, Request, Response } from 'express';
import { SessionService } from '../../services/SessionService';
import { ProfileModel } from '../../models/Profile';
import { SkinModel } from '../../models/Skin';
import { CapeModel } from '../../models/Cape';
import { signTextures } from '../../utils/crypto';
import { TexturesProperty } from '../../types/yggdrasil';
import { StorageService } from '../../services/StorageService';

const router = Router();

/**
 * POST /sessionserver/session/minecraft/join
 * 客户端加入服务器
 */
router.post('/session/minecraft/join', async (req: Request, res: Response) => {
  try {
    const { accessToken, selectedProfile, serverId } = req.body;

    if (!accessToken || !selectedProfile || !serverId) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Missing required parameters',
      });
    }

    await SessionService.joinServer(accessToken, selectedProfile, serverId);
    res.status(204).send();
  } catch (error: any) {
    if (error.message.includes('Invalid token')) {
      return res.status(403).json({
        error: 'ForbiddenOperationException',
        errorMessage: 'Invalid token.',
      });
    }

    console.error('Join error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: '服务器内部错误',
    });
  }
});

/**
 * GET /sessionserver/session/minecraft/hasJoined
 * 服务端验证客户端
 */
router.get('/session/minecraft/hasJoined', async (req: Request, res: Response) => {
  try {
    const { username, serverId, ip } = req.query;

    if (!username || !serverId) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Missing required parameters',
      });
    }

    const profile = await SessionService.hasJoined(
      username as string,
      serverId as string,
      ip as string | undefined
    );

    if (!profile) {
      return res.status(204).send();
    }

    // 返回角色信息（包含properties）
    const result: any = {
      id: profile.id,
      name: profile.name,
    };

    if (profile.properties && profile.properties.length > 0) {
      result.properties = profile.properties;
    }

    res.json(result);
  } catch (error: any) {
    console.error('HasJoined error:', error);
    res.status(204).send();
  }
});

/**
 * @openapi
 * /sessionserver/session/minecraft/profile/{uuid}:
 *   get:
 *     tags: [Session服务]
 *     summary: 获取玩家 Profile
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: 角色 UUID
 *       - in: query
 *         name: unsigned
 *         schema:
 *           type: string
 *         description: 是否返回未签名数据
 *     responses:
 *       200:
 *         description: 成功返回玩家 Profile
 *       204:
 *         description: 角色不存在
 */
router.get('/session/minecraft/profile/:uuid', async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;
    const { unsigned } = req.query;

    // 验证UUID格式
    if (!/^[0-9a-f]{32}$/i.test(uuid)) {
      return res.status(204).send();
    }

    // 查询角色
    const profile = await ProfileModel.findById(uuid);
    if (!profile) {
      return res.status(204).send();
    }

    // 构建响应
    const result: any = {
      id: profile.id,
      name: profile.name,
    };

    // 如果unsigned=false，需要签名
    if (unsigned !== 'true') {
      // 从数据库加载皮肤和披风
      const textures: any = {};

      if (profile.skin_id) {
        const skin = await SkinModel.findById(profile.skin_id);
        if (skin && (skin.is_public || skin.is_downloadable)) {
          textures.SKIN = {
            url: StorageService.getFileUrl(skin.file_path),
            metadata: {
              model: skin.model_type === 'slim' ? 'slim' : 'default',
            },
          };
        }
      }

      if (profile.cape_id) {
        const cape = await CapeModel.findById(profile.cape_id);
        if (cape && (cape.is_public || cape.is_downloadable)) {
          textures.CAPE = {
            url: StorageService.getFileUrl(cape.file_path),
          };
        }
      }

      const texturesProp: TexturesProperty = {
        timestamp: Date.now(),
        profileId: profile.id,
        profileName: profile.name,
        textures: Object.keys(textures).length > 0 ? textures : undefined,
      };

      // Base64编码
      const encoded = Buffer.from(JSON.stringify(texturesProp)).toString('base64');

      // 签名
      const signature = await signTextures(texturesProp);

      result.properties = [
        {
          name: 'textures',
          value: encoded,
          signature: signature,
        },
      ];
    } else {
      // 不签名
      const textures: any = {};

      if (profile.skin_id) {
        const skin = await SkinModel.findById(profile.skin_id);
        if (skin && (skin.is_public || skin.is_downloadable)) {
          textures.SKIN = {
            url: StorageService.getFileUrl(skin.file_path),
            metadata: {
              model: skin.model_type === 'slim' ? 'slim' : 'default',
            },
          };
        }
      }

      if (profile.cape_id) {
        const cape = await CapeModel.findById(profile.cape_id);
        if (cape && (cape.is_public || cape.is_downloadable)) {
          textures.CAPE = {
            url: StorageService.getFileUrl(cape.file_path),
          };
        }
      }

      const texturesProp: TexturesProperty = {
        timestamp: Date.now(),
        profileId: profile.id,
        profileName: profile.name,
        textures: Object.keys(textures).length > 0 ? textures : undefined,
      };

      result.properties = [
        {
          name: 'textures',
          value: Buffer.from(JSON.stringify(texturesProp)).toString('base64'),
        },
      ];
    }

    res.json(result);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(204).send();
  }
});

export default router;
