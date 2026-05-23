import { createClient, RedisClientType } from 'redis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// 创建Redis客户端
const redisClient: RedisClientType = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD,
});

// 错误处理
redisClient.on('error', (err: Error) => {
  console.error('❌ Redis错误:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis连接成功');
});

// 连接函数
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Redis连接失败:', error);
    throw error;
  }
}

// 获取客户端实例
export function getRedisClient(): RedisClientType {
  return redisClient;
}

export default redisClient;
