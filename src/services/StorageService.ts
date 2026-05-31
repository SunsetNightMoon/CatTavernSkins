import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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

    this.client = new S3Client({
      endpoint: config.s3.endpoint || undefined,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: true,
    });
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
      const config = getStorageConfig();
      if (config.type === 's3' && config.s3.endpoint && config.s3.accessKey && config.s3.secretKey) {
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

  static async getFileUrl(key: string): Promise<string> {
    return StorageService.getProvider().getUrl(key);
  }

  static isS3(): boolean {
    const config = getStorageConfig();
    return config.type === 's3' && !!config.s3.endpoint && !!config.s3.accessKey && !!config.s3.secretKey;
  }
}
