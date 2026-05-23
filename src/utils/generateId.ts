import DB from '../config/database';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * 生成唯一的皮肤公开ID：Skin + 20位随机码
 */
export async function generateSkinId(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const id = 'Skin' + randomString(20);
    const result = await DB.query('SELECT 1 FROM skins WHERE id = $1 LIMIT 1', [id]);
    if (result.rows.length === 0) {
      return id;
    }
    attempts++;
  }
  throw new Error('无法生成唯一的皮肤ID，请重试');
}

/**
 * 生成唯一的披风公开ID：Cape + 20位随机码
 */
export async function generateCapeId(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const id = 'Cape' + randomString(20);
    const result = await DB.query('SELECT 1 FROM capes WHERE id = $1 LIMIT 1', [id]);
    if (result.rows.length === 0) {
      return id;
    }
    attempts++;
  }
  throw new Error('无法生成唯一的披风ID，请重试');
}
