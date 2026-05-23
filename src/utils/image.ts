import sharp from 'sharp';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';

export interface SkinValidationResult {
  valid: boolean;
  model: 'default' | 'slim';
  width: number;
  height: number;
  error?: string;
}

/**
 * 验证皮肤文件
 * Minecraft皮肤标准：64x32（旧版）或 64x64（新版）
 */
export async function validateSkin(filePath: string): Promise<SkinValidationResult> {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // 检查宽度
    if (metadata.width !== 64) {
      return {
        valid: false,
        model: 'default',
        width: metadata.width || 0,
        height: metadata.height || 0,
        error: `皮肤宽度必须为64像素，当前为${metadata.width}像素`,
      };
    }

    // 检查高度
    if (metadata.height !== 32 && metadata.height !== 64) {
      return {
        valid: false,
        model: 'default',
        width: metadata.width,
        height: metadata.height || 0,
        error: `皮肤高度必须为32或64像素，当前为${metadata.height}像素`,
      };
    }

    // 检查格式
    if (metadata.format !== 'png') {
      return {
        valid: false,
        model: 'default',
        width: metadata.width,
        height: metadata.height || 0,
        error: '皮肤文件必须为PNG格式',
      };
    }

    // 检测是否为slim模型（袖子宽度为3像素而不是4像素）
    const isSlim = await detectSlimModel(filePath);

    return {
      valid: true,
      model: isSlim ? 'slim' : 'default',
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error: any) {
    return {
      valid: false,
      model: 'default',
      width: 0,
      height: 0,
      error: `皮肤验证失败: ${error.message}`,
    };
  }
}

/**
 * 检测是否为slim模型
 * 通过检查袖子区域的像素来判断
 */
async function detectSlimModel(filePath: string): Promise<boolean> {
  try {
    const image = sharp(filePath);
    const { data } = await image
      .extract({ left: 0, top: 0, width: 64, height: 32 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 检查左侧袖子区域（slim模型左侧袖子宽度为3像素）
    // 位置：x=46-48 (slim) vs x=46-49 (default)
    let defaultWidth = 0;
    let slimWidth = 0;

    for (let y = 0; y < 16; y++) {
      for (let x = 46; x < 50; x++) {
        const alpha = data[(y * 64 + x) * 4 + 3];
        if (x <= 48 && alpha > 0) slimWidth++;
        if (x <= 49 && alpha > 0) defaultWidth++;
      }
    }

    // 如果slim区域的像素明显少于default区域，则为slim模型
    return slimWidth < defaultWidth * 0.8;
  } catch {
    return false;
  }
}

/**
 * 处理皮肤文件（移除元数据，优化文件）
 */
export async function processSkin(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await sharp(inputPath)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

/**
 * 计算文件哈希（用于去重）
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  
  return hash.digest('hex');
}

/**
 * 验证披风文件
 * 披风标准尺寸：64x32
 */
export async function validateCape(filePath: string): Promise<SkinValidationResult> {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    if (metadata.width !== 64 || (metadata.height !== 32 && metadata.height !== 64)) {
      return {
        valid: false,
        model: 'default',
        width: metadata.width || 0,
        height: metadata.height || 0,
        error: '披风尺寸必须为64x32或64x64像素',
      };
    }

    if (metadata.format !== 'png') {
      return {
        valid: false,
        model: 'default',
        width: metadata.width || 0,
        height: metadata.height || 0,
        error: '披风文件必须为PNG格式',
      };
    }

    return {
      valid: true,
      model: 'default',
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error: any) {
    return {
      valid: false,
      model: 'default',
      width: 0,
      height: 0,
      error: `披风验证失败: ${error.message}`,
    };
  }
}
