import { Router, Request, Response } from 'express';
import { FavoriteModel } from '../../models/Favorite';
import { SkinModel } from '../../models/Skin';
import { CapeModel } from '../../models/Cape';
import { TokenModel } from '../../models/Token';

const router = Router();

async function authUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = await TokenModel.validate(authHeader.substring(7));
  return token ? { userId: token.user_id } : null;
}

/**
 * POST /api/skins/:id/favorite
 */
router.post('/skins/:id/favorite', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });

    const skinId = req.params.id;
    const skin = await SkinModel.findById(skinId);
    if (!skin) return res.status(404).json({ error: 'NotFound', errorMessage: '皮肤不存在' });

    // 不能收藏自己发布的皮肤
    if (skin.user_id === auth.userId) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '不能收藏自己发布的皮肤' });
    }

    await FavoriteModel.addSkinFavorite(auth.userId, skinId);
    const count = await FavoriteModel.getSkinFavoriteCount(skinId);
    return res.json({ message: '收藏成功', favoriteCount: count });
  } catch (error: any) {
    if (error.message === 'ALREADY_FAVORITED') {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '已经收藏过了' });
    }
    console.error('Add skin favorite error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '收藏失败' });
  }
});

/**
 * DELETE /api/skins/:id/favorite
 */
router.delete('/skins/:id/favorite', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });

    const skinId = req.params.id;
    await FavoriteModel.removeSkinFavorite(auth.userId, skinId);
    const count = await FavoriteModel.getSkinFavoriteCount(skinId);
    return res.json({ message: '已取消收藏', favoriteCount: count });
  } catch (error: any) {
    if (error.message === 'PUBLISHER_CANNOT_UNFAVORITE') {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '发布者无法取消收藏' });
    }
    console.error('Remove skin favorite error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '取消收藏失败' });
  }
});

/**
 * GET /api/skins/favorites
 */
router.get('/skins/favorites', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const skins = await FavoriteModel.getSkinFavorites(auth.userId, page, limit);
    const total = await FavoriteModel.getSkinFavoritesCount(auth.userId);

    return res.json({
      skins: skins.map((s: any) => ({
        id: s.id,
        file_path: (s.file_path || '').replace(/^\.\//, '/'),
        model_type: s.model_type,
        name: s.name,
        description: s.description,
        license_type: s.license_type,
        permission_level: s.permission_level,
        approval_status: s.approval_status,
        download_count: s.download_count,
        view_count: s.view_count,
        created_at: s.created_at,
        uploader_name: s.uploader_name || null,
        user_uid: s.user_uid,
      })),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Get skin favorites error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '获取收藏列表失败' });
  }
});

/**
 * GET /api/skins/:id/favorite-count
 */
router.get('/skins/:id/favorite-count', async (req: Request, res: Response) => {
  try {
    const skinId = req.params.id;
    const count = await FavoriteModel.getSkinFavoriteCount(skinId);
    return res.json({ favoriteCount: count });
  } catch (error: any) {
    console.error('Get favorite count error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '获取收藏数失败' });
  }
});

/**
 * GET /api/skins/:id/is-favorited
 */
router.get('/skins/:id/is-favorited', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.json({ isFavorited: false });

    const skinId = req.params.id;
    const isFavorited = await FavoriteModel.isSkinFavorited(auth.userId, skinId);
    return res.json({ isFavorited });
  } catch (error: any) {
    console.error('Check favorite status error:', error);
    return res.json({ isFavorited: false });
  }
});

/**
 * POST /api/capes/:id/favorite
 */
router.post('/capes/:id/favorite', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });

    const capeId = req.params.id;
    const cape = await CapeModel.findById(capeId);
    if (!cape) return res.status(404).json({ error: 'NotFound', errorMessage: '披风不存在' });

    // 不能收藏自己发布的披风
    if (cape.user_id === auth.userId) {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '不能收藏自己发布的披风' });
    }

    await FavoriteModel.addCapeFavorite(auth.userId, capeId);
    const count = await FavoriteModel.getCapeFavoriteCount(capeId);
    return res.json({ message: '收藏成功', favoriteCount: count });
  } catch (error: any) {
    if (error.message === 'ALREADY_FAVORITED') {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '已经收藏过了' });
    }
    console.error('Add cape favorite error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '收藏失败' });
  }
});

/**
 * DELETE /api/capes/:id/favorite
 */
router.delete('/capes/:id/favorite', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });

    const capeId = req.params.id;
    await FavoriteModel.removeCapeFavorite(auth.userId, capeId);
    const count = await FavoriteModel.getCapeFavoriteCount(capeId);
    return res.json({ message: '已取消收藏', favoriteCount: count });
  } catch (error: any) {
    if (error.message === 'PUBLISHER_CANNOT_UNFAVORITE') {
      return res.status(400).json({ error: 'BadRequest', errorMessage: '发布者无法取消收藏' });
    }
    console.error('Remove cape favorite error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '取消收藏失败' });
  }
});

/**
 * GET /api/capes/favorites
 */
router.get('/capes/favorites', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized', errorMessage: '请先登录' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const capes = await FavoriteModel.getCapeFavorites(auth.userId, page, limit);
    const total = await FavoriteModel.getCapeFavoritesCount(auth.userId);

    return res.json({
      capes: capes.map((c: any) => ({
        ...c,
        file_path: (c.file_path || '').replace(/^\.\//, '/'),
      })),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Get cape favorites error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '获取收藏列表失败' });
  }
});

/**
 * GET /api/capes/:id/favorite-count
 */
router.get('/capes/:id/favorite-count', async (req: Request, res: Response) => {
  try {
    const capeId = req.params.id;
    const count = await FavoriteModel.getCapeFavoriteCount(capeId);
    return res.json({ favoriteCount: count });
  } catch (error: any) {
    console.error('Get cape favorite count error:', error);
    return res.status(500).json({ error: 'InternalServerError', errorMessage: '获取收藏数失败' });
  }
});

/**
 * GET /api/capes/:id/is-favorited
 */
router.get('/capes/:id/is-favorited', async (req: Request, res: Response) => {
  try {
    const auth = await authUser(req);
    if (!auth) return res.json({ isFavorited: false });

    const capeId = req.params.id;
    const isFavorited = await FavoriteModel.isCapeFavorited(auth.userId, capeId);
    return res.json({ isFavorited });
  } catch (error: any) {
    console.error('Check cape favorite status error:', error);
    return res.json({ isFavorited: false });
  }
});

export default router;
