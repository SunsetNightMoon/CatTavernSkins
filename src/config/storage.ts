export function getStorageConfig() {
  return {
    type: (process.env.STORAGE_TYPE || 'local') as 'local' | 's3',
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      bucket: process.env.S3_BUCKET || 'skin-server',
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      region: process.env.S3_REGION || 'us-east-1',
      publicUrl: process.env.S3_PUBLIC_URL || '',
    },
    local: {
      uploadDir: process.env.UPLOAD_DIR || './uploads',
    },
  };
}
