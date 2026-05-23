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
  环境: ${process.env.NODE_ENV || 'development'}

  可用端点:
    - GET  /                          元数据API
    - POST /authserver/authenticate   认证
    - POST /authserver/refresh        刷新令牌
    - POST /authserver/validate       验证令牌
    - POST /authserver/invalidate    吊销令牌
    - POST /authserver/signout       登出
    - POST /sessionserver/session/minecraft/join
    - GET  /sessionserver/session/minecraft/hasJoined
    - GET  /sessionserver/session/minecraft/profile/:uuid
    - POST /api/profiles/minecraft
    - PUT  /api/user/profile/:uuid/:textureType
    - DELETE /api/user/profile/:uuid/:textureType
    - POST /api/setup/init            初始化
    - POST /api/auth/register       注册
    - POST /api/auth/login          登录
    - GET  /api/library/skins       皮肤库
    - POST /api/skins/upload        上传皮肤

  文档: https://github.com/your-repo/minecraft-skin-server
  `);
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
