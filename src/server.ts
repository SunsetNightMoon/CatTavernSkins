import app from './app';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { connectRedis } from './config/redis';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 连接 Redis
connectRedis().catch(err => {
  console.error('Failed to connect to Redis on startup:', err);
});

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

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

// 优雅退出
process.on('SIGTERM', () => {
  console.log('SIGTERM 信号接收，准备关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT 信号接收，准备关闭服务器...');
  process.exit(0);
});
