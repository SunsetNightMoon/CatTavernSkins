import { generateKeyPairSync, createSign, createVerify, createPrivateKey, randomUUID, KeyObject } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { TexturesProperty } from '../types/yggdrasil';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || './keys/private.pem';
const PUBLIC_KEY_PATH = process.env.RSA_PUBLIC_KEY_PATH || './keys/public.pem';

/**
 * 生成RSA密钥对
 */
export async function generateKeyPair(): Promise<void> {
  try {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // 确保目录存在
    const keyDir = path.dirname(PRIVATE_KEY_PATH);
    await fs.mkdir(keyDir, { recursive: true });

    // 保存密钥
    await fs.writeFile(PRIVATE_KEY_PATH, privateKey);
    await fs.writeFile(PUBLIC_KEY_PATH, publicKey);

    console.log('✅ RSA密钥对生成成功');
    console.log(`   私钥: ${PRIVATE_KEY_PATH}`);
    console.log(`   公钥: ${PUBLIC_KEY_PATH}`);
  } catch (error) {
    console.error('❌ 密钥生成失败:', error);
    throw error;
  }
}

/**
 * 加载私钥
 */
async function loadPrivateKey(): Promise<KeyObject> {
  try {
    const privateKeyPem = await fs.readFile(PRIVATE_KEY_PATH, 'utf-8');
    return createPrivateKey(privateKeyPem);
  } catch (error) {
    throw new Error('无法加载私钥，请先运行 npm run generate-keys');
  }
}

/**
 * 加载公钥
 */
export async function loadPublicKey(): Promise<string> {
  try {
    return await fs.readFile(PUBLIC_KEY_PATH, 'utf-8');
  } catch (error) {
    throw new Error('无法加载公钥，请先运行 npm run generate-keys');
  }
}

/**
 * 对textures属性进行签名
 */
export async function signTextures(textures: TexturesProperty): Promise<string> {
  const data = Buffer.from(JSON.stringify(textures)).toString('base64');
  
  const privateKey = await loadPrivateKey();
  const sign = createSign('SHA1');
  sign.update(data);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64');
  return signature;
}

/**
 * 验证textures属性签名
 */
export async function verifySignature(data: string, signature: string): Promise<boolean> {
  try {
    const publicKey = await loadPublicKey();
    const verify = createVerify('SHA1');
    verify.update(data);
    verify.end();
    
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    return false;
  }
}

/**
 * 生成访问控制令牌（用于材质上传API）
 */
export function generateAccessToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcrypt');
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 验证密码
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = require('bcrypt');
  return await bcrypt.compare(password, hash);
}
