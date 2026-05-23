#!/usr/bin/env node
import { generateKeyPair } from '../utils/crypto';

async function main() {
  console.log('正在生成RSA密钥对...');
  await generateKeyPair();
  console.log('密钥对生成完成！');
  process.exit(0);
}

main().catch((error) => {
  console.error('生成失败:', error);
  process.exit(1);
});
