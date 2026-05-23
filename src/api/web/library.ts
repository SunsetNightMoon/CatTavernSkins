import { Router, Request, Response } from 'express';
import { CacheHelper } from '../../config/cache';
import { DB } from '../../config/database';
import { CapeModel } from '../../models/Cape';

const router = Router();

/**
 * GET /api/library/skins
 * 浏览皮肤（分页）
 */
router.get('/skins', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offset = (pageNum - 1) * limitNum;

    const cacheKey = `skins:page${pageNum}:limit${limitNum}`;

    const cached = await CacheHelper.getLibraryList(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // 通用查询（SQLite + PostgreSQL 兼容）
    // 先查总数（仅已审核通过的）
    const countResult = await DB.query(
      "SELECT COUNT(*) as total FROM skins WHERE approval_status = $1",
      ['approved']
    );
    const total = countResult.rows[0]?.total || 0;

    // 查询列表（仅已审核通过的，包含上传者信息）
    const result = await DB.query(
      `SELECT s.*, u.user_uid, u.email as uploader_email,
              (SELECT p.name FROM profiles p WHERE p.user_id = s.user_id LIMIT 1) as uploader_name
       FROM skins s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.approval_status = 'approved'
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset]
    );

    // 将相对路径转为可访问URL
    const skins = result.rows.map((skin: any) => ({
      ...skin,
      file_path: skin.file_path?.replace(/^\.\//, '/'),
    }));

    const response = {
      page: pageNum,
      limit: limitNum,
      total,
      skins,
    };

    await CacheHelper.setLibraryList(cacheKey, JSON.stringify(response));

    res.json(response);
  } catch (error: any) {
    console.error('Library skins error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

/**
 * GET /api/library/skins/:id
 * 查看皮肤详情
 */
router.get('/skins/:id', async (req: Request, res: Response) => {
  try {
    const skinId = req.params.id;
    const cached = await CacheHelper.getSkinMetadata(skinId);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await DB.query(
      `SELECT s.*, u.user_uid, u.email as uploader_email,
              (SELECT p.name FROM profiles p WHERE p.user_id = s.user_id LIMIT 1) as uploader_name
       FROM skins s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [skinId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '皮肤不存在' });
    }

    const skin = result.rows[0];

    // 检查是否已审核通过
    if (skin.approval_status !== 'approved') {
      return res.status(404).json({ error: 'NotFound', errorMessage: '该皮肤暂未通过审核' });
    }

    skin.file_path = skin.file_path?.replace(/^\.\//, '/');

    // 增加浏览计数
    await DB.query(
      'UPDATE skins SET view_count = view_count + 1 WHERE id = $1',
      [skinId]
    );

    await CacheHelper.setSkinMetadata(skinId, skin);

    res.json(skin);
  } catch (error: any) {
    console.error('Library skin detail error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

/**
 * GET /api/library/capes
 * 浏览披风（分页）
 */
router.get('/capes', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

    const cacheKey = `capes:page${pageNum}:limit${limitNum}`;
    const cached = await CacheHelper.getLibraryList(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const { capes: rawCapes, total } = await CapeModel.findPublic(pageNum, limitNum);

    // 将相对路径转为可访问URL
    const capes = rawCapes.map((cape: any) => ({
      ...cape,
      file_path: cape.file_path?.replace(/^\.\//, '/'),
    }));

    const response = { page: pageNum, limit: limitNum, total, capes };

    await CacheHelper.setLibraryList(cacheKey, JSON.stringify(response));

    res.json(response);
  } catch (error: any) {
    console.error('Library capes error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

/**
 * GET /api/library/capes/:id
 * 查看披风详情
 */
router.get('/capes/:id', async (req: Request, res: Response) => {
  try {
    const capeId = req.params.id;

    const result = await DB.query(
      `SELECT c.*, u.user_uid, u.email as uploader_email,
              (SELECT p.name FROM profiles p WHERE p.user_id = c.user_id LIMIT 1) as uploader_name
       FROM capes c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [capeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', errorMessage: '披风不存在' });
    }

    const cape = result.rows[0];

    // 检查是否已审核通过
    if (cape.approval_status !== 'approved') {
      return res.status(404).json({ error: 'NotFound', errorMessage: '该披风暂未通过审核' });
    }

    // 增加浏览计数（仅已审核通过的）
    await CapeModel.incrementViewCount(capeId);

    cape.file_path = cape.file_path?.replace(/^\.\//, '/');
    res.json({
      ...cape,
      approval_status: cape.approval_status,
    });
  } catch (error: any) {
    console.error('Library cape detail error:', error);
    res.status(500).json({ error: 'InternalServerError', errorMessage: error.message });
  }
});

export default router;
