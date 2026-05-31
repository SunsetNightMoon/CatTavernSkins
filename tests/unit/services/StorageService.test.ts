import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LocalStorageProvider } from '../../../src/services/StorageService';

jest.mock('../../../src/config/storage', () => ({
  getStorageConfig: jest.fn().mockReturnValue({
    type: 'local',
    s3: {
      endpoint: '',
      bucket: 'skin-server',
      accessKey: '',
      secretKey: '',
      region: 'us-east-1',
      publicUrl: '',
    },
    local: {
      uploadDir: '',
    },
  }),
}));

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    const { getStorageConfig } = require('../../../src/config/storage');
    (getStorageConfig as jest.Mock).mockReturnValue({
      type: 'local',
      s3: { endpoint: '', bucket: 'skin-server', accessKey: '', secretKey: '', region: 'us-east-1', publicUrl: '' },
      local: { uploadDir: tmpDir },
    });
    provider = new LocalStorageProvider();
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should upload file to local filesystem', async () => {
    const key = 'skins/test-skin.png';
    const data = Buffer.from('fake png data');
    const result = await provider.upload(key, data);
    expect(result).toBeDefined();

    const fullPath = path.join(tmpDir, key);
    const content = await fs.readFile(fullPath);
    expect(content.toString()).toBe('fake png data');
  });

  it('should delete local file', async () => {
    const key = 'skins/delete-test.png';
    const data = Buffer.from('to be deleted');
    const uploadResult = await provider.upload(key, data);

    await provider.delete(uploadResult);

    const fullPath = path.resolve(process.cwd(), uploadResult.replace(/^\.\//, ''));
    await expect(fs.access(fullPath)).rejects.toThrow();
  });

  it('should return correct URL', async () => {
    const url = await provider.getUrl('skins/test.png');
    expect(url).toBe('/skins/test.png');
  });

  it('should check if file exists', async () => {
    const key = 'skins/exists-test.png';
    const data = Buffer.from('exists test');
    const uploadResult = await provider.upload(key, data);

    const exists = await provider.exists(uploadResult);
    expect(exists).toBe(true);

    const notExists = await provider.exists('./nonexistent-file.png');
    expect(notExists).toBe(false);
  });
});

describe('StorageService.isS3', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return false for isS3 when STORAGE_TYPE=local', () => {
    process.env.STORAGE_TYPE = 'local';
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;

    jest.doMock('../../../src/config/storage', () => ({
      getStorageConfig: () => ({
        type: 'local',
        s3: { endpoint: '', bucket: 'skin-server', accessKey: '', secretKey: '', region: 'us-east-1', publicUrl: '' },
        local: { uploadDir: './uploads' },
      }),
    }));

    const { StorageService } = require('../../../src/services/StorageService');
    expect(StorageService.isS3()).toBe(false);
  });

  it('should return true for isS3 when STORAGE_TYPE=s3 and config is complete', () => {
    process.env.STORAGE_TYPE = 's3';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_ACCESS_KEY = 'minioadmin';
    process.env.S3_SECRET_KEY = 'minioadmin';

    jest.doMock('../../../src/config/storage', () => ({
      getStorageConfig: () => ({
        type: 's3',
        s3: { endpoint: 'http://localhost:9000', bucket: 'skin-server', accessKey: 'minioadmin', secretKey: 'minioadmin', region: 'us-east-1', publicUrl: '' },
        local: { uploadDir: './uploads' },
      }),
    }));

    const { StorageService } = require('../../../src/services/StorageService');
    expect(StorageService.isS3()).toBe(true);
  });
});
