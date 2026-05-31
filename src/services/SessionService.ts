import DB from '../config/database';
import { TokenModel } from '../models/Token';
import { ProfileModel, Profile } from '../models/Profile';
import { SkinModel } from '../models/Skin';
import { CapeModel } from '../models/Cape';
import { loadPublicKey, signTextures } from '../utils/crypto';
import { StorageService } from './StorageService';
import { TexturesProperty } from '../types/yggdrasil';

export class SessionService {
  /**
   * 客户端加入服务器（join）
   */
  static async joinServer(
    accessToken: string,
    selectedProfile: string,
    serverId: string
  ): Promise<void> {
    // 验证令牌
    const token = await TokenModel.validate(accessToken);
    if (!token) {
      throw new Error('ForbiddenOperationException: Invalid token.');
    }

    // 验证角色是否属于该用户
    const profile = await ProfileModel.findById(selectedProfile);
    if (!profile || profile.user_id !== token.user_id) {
      throw new Error('ForbiddenOperationException: Invalid token.');
    }

    // 存储会话信息（设置30秒过期）- 使用 SQLite datetime 函数
    await DB.query(
      `INSERT INTO sessions (server_id, access_token, profile_id, created_at, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, datetime('now', '+30 seconds'))
       ON CONFLICT(server_id) DO UPDATE SET
         access_token = excluded.access_token,
         profile_id = excluded.profile_id,
         created_at = CURRENT_TIMESTAMP,
         expires_at = excluded.expires_at`,
      [serverId, accessToken, selectedProfile]
    );
  }

  /**
   * 服务端验证客户端（hasJoined）
   */
  static async hasJoined(
    username: string,
    serverId: string,
    _ip?: string
  ): Promise<Profile | null> {
    // 查找会话
    const result: any = await DB.query(
      `SELECT s.*, t.user_id 
       FROM sessions s
       JOIN tokens t ON s.access_token = t.token
       WHERE s.server_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [serverId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];

    // 获取角色信息
    const profile = await ProfileModel.findById(session.profile_id);
    if (!profile || profile.name !== username) {
      return null;
    }

    // 加载公钥（用于签名）
    await loadPublicKey();

    // 构建textures属性
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

    // 签名（如果需要）
    const signature = await signTextures(texturesProp);

    // 添加属性和签名到profile
    profile.properties = [
      {
        name: 'textures',
        value: encoded,
        signature: signature,
      },
    ];

    return profile;
  }
}
