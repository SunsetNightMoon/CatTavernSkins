import { Router, Request, Response } from 'express';
import { ProfileModel } from '../../models/Profile';

const router = Router();

/**
 * POST /api/profiles/minecraft
 * 批量查询角色信息（通过角色名）
 */
router.post('/minecraft', async (req: Request, res: Response) => {
  try {
    const names: string[] = req.body;

    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Request body must be a non-empty array',
      });
    }

    if (names.length > 10) {
      return res.status(400).json({
        error: 'IllegalArgumentException',
        errorMessage: 'Too many profiles requested (max 10)',
      });
    }

    // 批量查询
    const profiles = await ProfileModel.findBatchByNames(names);

    const result = profiles.map(p => ({
      id: p.id,
      name: p.name,
    }));

    res.json(result);
  } catch (error) {
    console.error('Profiles error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      errorMessage: '服务器内部错误',
    });
  }
});

export default router;
