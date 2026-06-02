import * as fs from 'fs';
import * as path from 'path';

/**
 * 安全备份数据库文件
 * 只在迁移前执行，只复制文件，绝不删除或修改原始数据
 * @param dbPath 数据库文件路径
 * @returns 备份是否成功
 */
export function backupDatabaseBeforeMigration(dbPath: string): boolean {
  try {
    // 1. 检查源文件是否存在
    if (!fs.existsSync(dbPath)) {
      console.log('[backup] 数据库文件不存在，跳过备份');
      return true; // 不存在也不是错误，可能是首次创建
    }

    // 2. 创建备份目录
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`[backup] 创建备份目录: ${backupDir}`);
    }

    // 3. 生成备份文件名（使用时间戳，避免覆盖）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `skin_server_migration_before_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    // 4. 执行备份（只复制，不删除，不修改原文件）
    fs.copyFileSync(dbPath, backupPath);

    // 5. 验证备份文件是否创建成功
    if (!fs.existsSync(backupPath)) {
      console.error('[backup] 备份文件创建失败');
      return false;
    }

    const originalSize = fs.statSync(dbPath).size;
    const backupSize = fs.statSync(backupPath).size;

    if (originalSize !== backupSize) {
      console.error(`[backup] 备份文件大小不匹配: 原始=${originalSize}, 备份=${backupSize}`);
      return false;
    }

    console.log(`✅ [backup] 数据库备份成功: ${backupPath} (${originalSize} bytes)`);
    return true;

  } catch (error: any) {
    console.error('[backup] 备份失败:', error.message);
    return false;
  }
}

/**
 * 清理旧备份文件（保留最近 N 个）
 * @param backupDir 备份目录
 * @param keepCount 保留的数量
 */
export function cleanupOldBackups(backupDir: string, keepCount: number = 10): void {
  try {
    if (!fs.existsSync(backupDir)) {
      return;
    }

    // 读取所有备份文件
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('skin_server_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime()); // 按时间降序

    // 删除超出保留数量的旧备份
    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      toDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`[backup] 删除旧备份: ${file.name}`);
        } catch (err: any) {
          console.warn(`[backup] 删除旧备份失败 ${file.name}:`, err.message);
        }
      });
    }
  } catch (error: any) {
    console.warn('[backup] 清理旧备份失败:', error.message);
  }
}
