import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

/**
 * 生成随机UUID（无符号格式）
 * 符合Yggdrasil API规范
 */
export function generateUUID(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * 生成离线模式UUID（兼容原有系统）
 * 使用Minecraft官方离线UUID生成算法
 */
export function generateOfflineUUID(playerName: string): string {
  const hash = createHash('md5')
    .update(`OfflinePlayer:${playerName}`)
    .digest('hex');
  
  // 格式化为UUID v3格式
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join('-').replace(/-/g, '');
}

/**
 * 验证UUID格式（无符号）
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{32}$/i.test(uuid);
}

/**
 * 将带分隔符的UUID转换为无符号格式
 */
export function toUnsignedUUID(uuid: string): string {
  return uuid.replace(/-/g, '');
}

/**
 * 将无符号UUID转换为带分隔符格式（用于日志）
 */
export function toDashedUUID(uuid: string): string {
  if (uuid.includes('-')) return uuid;
  
  return [
    uuid.substring(0, 8),
    uuid.substring(8, 12),
    uuid.substring(12, 16),
    uuid.substring(16, 20),
    uuid.substring(20, 32),
  ].join('-');
}
