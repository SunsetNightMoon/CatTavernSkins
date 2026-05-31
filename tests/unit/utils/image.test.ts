import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateSkin, validateCape, calculateFileHash } from '../../../src/utils/image';

let tmpDir: string;

async function createPng(width: number, height: number): Promise<string> {
  const filePath = path.join(tmpDir, `${width}x${height}.png`);
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 128 },
    },
  })
    .png()
    .toFile(filePath);
  return filePath;
}

async function createJpeg(width: number, height: number): Promise<string> {
  const filePath = path.join(tmpDir, `${width}x${height}.jpg`);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toFile(filePath);
  return filePath;
}

describe('Image Utils', () => {
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('validateSkin', () => {
    it('should accept valid 64x64 skin', async () => {
      const filePath = await createPng(64, 64);
      const result = await validateSkin(filePath);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should accept valid 64x32 skin', async () => {
      const filePath = await createPng(64, 32);
      const result = await validateSkin(filePath);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(64);
      expect(result.height).toBe(32);
    });

    it('should reject non-PNG file', async () => {
      const filePath = await createJpeg(64, 64);
      const result = await validateSkin(filePath);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject incorrect dimensions', async () => {
      const filePath = await createPng(32, 32);
      const result = await validateSkin(filePath);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateCape', () => {
    it('should accept valid cape image', async () => {
      const filePath = await createPng(64, 32);
      const result = await validateCape(filePath);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(64);
      expect(result.height).toBe(32);
    });
  });

  describe('calculateFileHash', () => {
    it('should return correct SHA-256 hash', async () => {
      const filePath = path.join(tmpDir, 'hash-test.png');
      const content = Buffer.from('test content for hash');
      await fs.writeFile(filePath, content);

      const hash = await calculateFileHash(filePath);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
