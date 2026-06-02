import dotenv from 'dotenv';
import * as path from 'path';
import { runMigrations } from '../utils/migrate';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbType = process.env.DB_TYPE || 'postgres';

runMigrations(dbType).catch(err => {
  console.error('Migration 运行失败:', err);
  process.exit(1);
});
