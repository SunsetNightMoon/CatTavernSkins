import redis from './redis';

export class CacheHelper {
  // 缓存TTL（秒）
  static readonly TTL = {
    USER_PROFILE: 300,      // 5分钟
    SKIN_METADATA: 600,     // 10分钟
    SESSION_VALIDATE: 120,  // 2分钟
    LIBRARY_LIST: 180,      // 3分钟
  };

  // 获取缓存
  static async get(key: string): Promise<string | null> {
    try {
      const client = redis;
      return await client.get(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // 设置缓存
  static async set(key: string, value: string, ttl: number = 300): Promise<void> {
    try {
      const client = redis;
      await client.set(key, value, { EX: ttl });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // 删除缓存
  static async del(key: string): Promise<void> {
    try {
      const client = redis;
      await client.del(key);
    } catch (error) {
      console.error('Cache del error:', error);
    }
  }

  // 用户资料缓存
  static async getUserProfile(userId: string): Promise<any | null> {
    const cacheKey = `user:profile:${userId}`;
    const cached = await this.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  static async setUserProfile(userId: string, profile: any): Promise<void> {
    const cacheKey = `user:profile:${userId}`;
    await this.set(cacheKey, JSON.stringify(profile), this.TTL.USER_PROFILE);
  }

  // 皮肤元数据缓存
  static async getSkinMetadata(skinId: string): Promise<any | null> {
    const cacheKey = `skin:metadata:${skinId}`;
    const cached = await this.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  static async setSkinMetadata(skinId: string, metadata: any): Promise<void> {
    const cacheKey = `skin:metadata:${skinId}`;
    await this.set(cacheKey, JSON.stringify(metadata), this.TTL.SKIN_METADATA);
  }

  // 皮肤库列表缓存
  static async getLibraryList(cacheKey: string): Promise<any | null> {
    const cached = await this.get(`library:${cacheKey}`);
    return cached ? JSON.parse(cached) : null;
  }

  static async setLibraryList(cacheKey: string, data: any): Promise<void> {
    await this.set(`library:${cacheKey}`, JSON.stringify(data), this.TTL.LIBRARY_LIST);
  }

  // 清除用户相关缓存
  static async clearUserCache(userId: string): Promise<void> {
    await this.del(`user:profile:${userId}`);
  }

  // 清除皮肤相关缓存
  static async clearSkinCache(skinId: string): Promise<void> {
    await this.del(`skin:metadata:${skinId}`);
  }

  // 清除皮肤库缓存（数据变更时调用）
  static async clearLibraryCache(): Promise<void> {
    try {
      const client = redis;
      const keys = await client.keys('library:*');
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error('Clear library cache error:', error);
    }
  }
}
