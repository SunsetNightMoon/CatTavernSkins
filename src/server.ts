import app from './app';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { connectRedis } from './config/redis';
import { runMigrations } from './utils/migrate';
import { backupDatabaseBeforeMigration, cleanupOldBackups } from './utils/backup';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  // 0. 先备份数据库（只在迁移前备份，绝不删除原始数据）
  try {
    const dbPath = path.join(__dirname, '../data/skin_server.db');
    const backupSuccess = backupDatabaseBeforeMigration(dbPath);
    
    if (!backupSuccess) {
      console.warn('[startup] 数据库备份失败，但为了安全仍然继续启动...');
    }
    
    // 清理旧备份（只保留最近 10 个）
    const backupDir = path.join(__dirname, '../data/backups');
    cleanupOldBackups(backupDir, 10);
  } catch (backupErr: any) {
    console.warn('[startup] 备份过程出错（非致命）:', backupErr.message);
    // 备份失败不阻止启动
  }

  // 1. 运行数据库迁移，失败则退出
  try {
    const dbType = process.env.DB_TYPE || 'postgres';
    await runMigrations(dbType);
  } catch (err: any) {
    console.error('[migrate] 数据库迁移失败，服务器无法启动:', err.message);
    process.exit(1);
  }

  // 连接 Redis
  try {
    await connectRedis();
  } catch (err) {
    console.error('Failed to connect to Redis on startup:', err);
  }

  app.listen(PORT, HOST, () => {
    console.log(`
==================================
  Minecraft Skin Server - Yggdrasil API Compatible
==================================

  服务器启动成功！
  监听地址: ${HOST}:${PORT}
  环境: ${process.env.NODE_ENV || 'development'}`);

    // 启动后执行主题图片迁移（不阻塞启动）
    import('./api/web/admin').then(({ migrateThemeImages }) => {
      migrateThemeImages().catch(err => console.error('[migrate] 主题图片迁移失败:', err));
    });
  });
}

startServer();

// 优雅退出
process.on('SIGTERM', () => {
  console.log('SIGTERM 信号接收，准备关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT 信号接收，准备关闭服务器...');
  process.exit(0);
});
