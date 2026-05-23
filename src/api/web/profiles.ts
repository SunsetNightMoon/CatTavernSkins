import { Router, Request, Response } from 'express';
import { ProfileModel } from '../../models/Profile';
import { TokenModel } from '../../models/Token';

const router = Router();

/**
 * GET /api/profiles
 * 获取用户的角色列表
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

    // 获取用户的角色列表
    const profiles = await ProfileModel.findByUserId(token.user_id);

    res.json(profiles.map(p => ({
      id: p.id,
      name: p.name,
      skin_id: p.skin_id,
      cape_id: p.cape_id,
      created_at: p.created_at,
    })));
  } catch (error: any) {
    console.error('Get profiles error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '获取角色列表失败',
    });
  }
});

/**
 * POST /api/profiles
 * 创建新角色
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    // 验证参数
    if (!name || name.length < 3 || name.length > 16) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '角色名长度必须在3-16个字符之间',
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '角色名只能包含字母、数字和下划线',
      });
    }

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

    // 检查角色名是否已存在
    const existingProfile = await ProfileModel.findByName(name);
    if (existingProfile) {
      return res.status(409).json({
        error: 'Conflict',
        errorMessage: '该角色名已被使用',
      });
    }

    // 创建角色
    const profile = await ProfileModel.create({
      name,
      userId: token.user_id,
    });

    res.status(201).json({
      message: '角色创建成功',
      profile: {
        id: profile.id,
        name: profile.name,
        created_at: profile.created_at,
      },
    });
  } catch (error: any) {
    console.error('Create profile error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '创建角色失败',
    });
  }
});

/**
 * GET /api/profiles/check-name
 * 检查角色名是否可用（公开接口，无需登录）
 */
router.get('/check-name', async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '请提供角色名',
      });
    }

    // 验证名称格式
    if (name.length < 3 || name.length > 16) {
      return res.status(200).json({
        available: false,
        message: '角色名长度必须在3-16个字符之间',
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return res.status(200).json({
        available: false,
        message: '角色名只能包含字母、数字和下划线',
      });
    }

    const isTaken = await ProfileModel.isNameTaken(name);
    res.status(200).json({
      available: !isTaken,
      message: isTaken ? '该角色名已被使用' : '角色名可用',
    });
  } catch (error: any) {
    console.error('Check name error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '检查角色名失败',
    });
  }
});

/**
 * PUT /api/profiles/:uuid/name
 * 更新角色名称（30天冷却）
 */
router.put('/:uuid/name', async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;
    const { name } = req.body;

    // 验证参数
    if (!name || name.length < 3 || name.length > 16) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '角色名长度必须在3-16个字符之间',
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '角色名只能包含字母、数字和下划线',
      });
    }

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

    // 获取角色信息
    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Profile does not belong to user',
      });
    }

    // 检查名称是否被使用
    if (name !== profile.name) {
      const isTaken = await ProfileModel.isNameTaken(name, uuid);
      if (isTaken) {
        return res.status(409).json({
          error: 'Conflict',
          errorMessage: '该角色名已被使用',
        });
      }
    } else {
      return res.status(400).json({
        error: 'BadRequest',
        errorMessage: '新名称与当前名称相同',
      });
    }

    // 检查30天冷却期
    if (profile.name_changed_at) {
      const lastChanged = new Date(profile.name_changed_at);
      const cooldownDays = 30;
      const cooldownEnd = new Date(lastChanged);
      cooldownEnd.setDate(cooldownEnd.getDate() + cooldownDays);

      if (new Date() < cooldownEnd) {
        const daysRemaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return res.status(429).json({
          error: 'TooManyRequests',
          errorMessage: `改名冷却中，${daysRemaining}天后可再次改名`,
          cooldown_end: cooldownEnd.toISOString(),
          days_remaining: daysRemaining,
        });
      }
    }

    // 更新名称
    const updatedProfile = await ProfileModel.updateName(uuid, name);

    res.json({
      message: '角色名已更新',
      profile: {
        id: updatedProfile.id,
        name: updatedProfile.name,
        name_changed_at: updatedProfile.name_changed_at,
      },
    });
  } catch (error: any) {
    console.error('Update name error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '更新角色名失败',
    });
  }
});

/**
 * DELETE /api/profiles/:uuid
 * 删除角色
 */
router.delete('/:uuid', async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

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

    // 验证角色是否属于该用户
    const profile = await ProfileModel.findById(uuid);
    if (!profile || profile.user_id !== token.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        errorMessage: 'Profile does not belong to user',
      });
    }

    // 删除角色
    await ProfileModel.delete(uuid);

    res.status(204).send();
  } catch (error: any) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: error.message || '删除角色失败',
    });
  }
});

export default router;
