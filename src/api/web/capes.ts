import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import { CapeModel } from '../../models/Cape';
import { TokenModel } from '../../models/Token';

const router = Router();

/**
 * GET /api/capes/mine
 * 获取当前用户的所有披风
 */
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = await TokenModel.validate(authHeader.substring(7));
    if (!token) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: 'Token 无效' });
    }

    const capes = await CapeModel.findByUserId(token.user_id);
    res.json({
      capes: capes.map(c => ({
        ...c,
        file_path: c.file_path?.replace(/^\.\//, '/'),
        approval_status: c.approval_status,
      })),
    });
  } catch (error: any) {
    console.error('Get user capes error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message || '获取披风列表失败' });
  }
});

/**
 * PUT /api/capes/:capeId
 * 更新披风信息
 */
router.put('/:capeId', async (req: Request, res: Response) => {
  try {
    const { capeId } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = await TokenModel.validate(authHeader.substring(7));
    if (!token) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: 'Token 无效' });
    }

    const cape = await CapeModel.findById(capeId);
    if (!cape || cape.user_id !== token.user_id) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: '披风不存在或无权修改' });
    }

    const { name, description, license_type, permission_level } = req.body;
    await CapeModel.updateInfo(capeId, { name, description, license_type, permission_level });
    res.json({ message: '披风信息已更新' });
  } catch (error: any) {
    console.error('Update cape error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message || '更新失败' });
  }
});

/**
 * DELETE /api/capes/:capeId
 * 删除披风
 */
router.delete('/:capeId', async (req: Request, res: Response) => {
  try {
    const { capeId } = req.params;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });
    }

    const token = await TokenModel.validate(authHeader.substring(7));
    if (!token) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: 'Token 无效' });
    }

    const cape = await CapeModel.findById(capeId);
    if (!cape || cape.user_id !== token.user_id) {
      return res.status(403).json({ error: 'Forbidden', errorMessage: '披风不存在或无权删除' });
    }

    // 删除文件
    const filePath = cape.file_path.startsWith('/')
      ? cape.file_path
      : require('path').resolve(process.cwd(), cape.file_path);
    await fs.unlink(filePath).catch(() => {});

    await CapeModel.delete(capeId);

    res.status(204).send();
  } catch (error: any) {
    console.error('Delete cape error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message || '删除失败' });
  }
});

export default router;
