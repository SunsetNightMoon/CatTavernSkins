import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, S3ClientConfig, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getStorageConfig } from '../config/storage';

export interface StorageProvider {
  upload(key: string, data: Buffer, contentType?: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    const config = getStorageConfig();
    this.uploadDir = path.resolve(config.local.uploadDir);
  }

  async upload(key: string, data: Buffer, _contentType?: string): Promise<string> {
    const fullPath = path.join(this.uploadDir, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return './' + path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.resolve(process.cwd(), key.replace(/^\.\//, ''));
    await fs.unlink(fullPath).catch(() => {});
  }

  async getUrl(key: string): Promise<string> {
    return '/' + key.replace(/^\.\//, '');
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.resolve(process.cwd(), key.replace(/^\.\//, ''));
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const config = getStorageConfig();
    this.bucket = config.s3.bucket;
    this.publicUrl = config.s3.publicUrl;

    // 仅在配置了自定义 endpoint（MinIO 等 S3 兼容服务）时设置 endpoint + forcePathStyle；
    // 真实 AWS S3 不设置 endpoint（使用 SDK 默认），并使用虚拟主机寻址。
    const clientConfig: S3ClientConfig = {
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
    };
    if (config.s3.endpoint) {
      clientConfig.endpoint = config.s3.endpoint;
      clientConfig.forcePathStyle = true;
    }
    this.client = new S3Client(clientConfig);
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType || 'image/png',
    }));
    return key;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })).catch(() => {});
  }

  async getUrl(key: string): Promise<string> {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    return await getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }), { expiresIn: 3600 });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }
}

export class StorageService {
  private static provider: StorageProvider | null = null;

  static getProvider(): StorageProvider {
    if (!StorageService.provider) {
      if (StorageService.isS3()) {
        StorageService.provider = new S3StorageProvider();
      } else {
        StorageService.provider = new LocalStorageProvider();
      }
    }
    return StorageService.provider;
  }

  static async uploadFile(key: string, data: Buffer, contentType?: string): Promise<string> {
    return StorageService.getProvider().upload(key, data, contentType);
  }

  static async deleteFile(key: string): Promise<void> {
    return StorageService.getProvider().delete(key);
  }

  /**
   * 构建纹理/媒体文件的公开访问 URL（皮肤、披风等）。
   * 同步方法，便于在响应构建中直接调用。
   *
   * 输入 filePath 为数据库中存储的 file_path：
   *  - 本地存储: 形如 "./uploads/skins/x.png"（已包含 uploads/ 前缀）
   *  - S3 存储:  形如 "skins/x.png"（裸 key，无 uploads/ 前缀）
   *
   * 输出：
   *  - 本地:            `${BASE_URL}/uploads/skins/x.png`
   *  - S3（无 publicUrl）: `${BASE_URL}/uploads/skins/x.png`（经由 /uploads/:subdir/:filename 代理路由）
   *  - S3（有 publicUrl）: `${publicUrl}/skins/x.png`（直连 CDN）
   */
  static getFileUrl(filePath: string): string {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const cleaned = filePath.replace(/^\.\//, '');

    if (StorageService.isS3()) {
      const config = getStorageConfig();
      // S3 存储的 file_path 是裸 key（如 "skins/x.png"）。
      if (config.s3.publicUrl) {
        return `${config.s3.publicUrl}/${cleaned}`;
      }
      // 无 CDN：通过本服务的代理路由 /uploads/<key> 提供。
      return `${baseUrl}/uploads/${cleaned}`;
    }

    // 本地存储：file_path 已包含 uploads/ 前缀。
    return `${baseUrl}/${cleaned}`;
  }

  static isS3(): boolean {
    const config = getStorageConfig();
    return config.type === 's3'
      && !!config.s3.accessKey
      && !!config.s3.secretKey
      && !!config.s3.bucket;
  }
}
