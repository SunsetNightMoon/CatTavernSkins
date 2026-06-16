import { Router, Request, Response } from 'express';
import { SetupService } from '../../services/SetupService';
import nodemailer from 'nodemailer';
import { createClient, RedisClientType } from 'redis';
import { Pool } from 'pg';
import * as path from 'path';
import { t, getLang } from '../../utils/setupI18n';

const router = Router();

/**
 * GET /api/setup/status
 * 检查系统是否已初始化
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const isSetup = await SetupService.isSetupCompleted();
    res.json({ setup_completed: isSetup });
  } catch (error: any) {
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

/**
 * POST /api/setup/test-db
 * 测试数据库连接（支持 SQLite / PostgreSQL）
 */
router.post('/test-db', async (req: Request, res: Response) => {
  const lang = getLang(req);
  try {
    const isSetup = await SetupService.isSetupCompleted();
    if (isSetup) {
      return res.status(403).json({ success: false, message: t('systemAlreadyInitialized', lang) });
    }

    const { db_type, db_host, db_port, db_name, db_user, db_password } = req.body;

    if (db_type === 'sqlite') {
      // SQLite：检查 data 目录是否可写
      const fs = require('fs');
      const dbPath = './data/skin_server.db';
      const dbDir = path.dirname(dbPath);
      try {
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        // 尝试写一个临时文件测试权限
        const testFile = path.join(dbDir, '.write_test');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        return res.json({ success: true, message: t('sqliteWritable', lang) });
      } catch (e: any) {
        return res.status(400).json({ success: false, message: t('sqliteTestFailed', lang, { detail: e.message }) });
      }
    }

    if (db_type === 'postgresql') {
      if (!db_host || !db_name || !db_user) {
        return res.status(400).json({ success: false, message: t('pgInfoIncomplete', lang) });
      }

      const testPool = new Pool({
        host: db_host,
        port: parseInt(db_port || '5432'),
        database: db_name,
        user: db_user,
        password: db_password || '',
        connectionTimeoutMillis: 5000,
        max: 1,
      });

      try {
        const client = await testPool.connect();
        await client.query('SELECT 1');
        client.release();
        await testPool.end();
        return res.json({ success: true, message: t('pgConnectSuccess', lang) });
      } catch (e: any) {
        await testPool.end();
        let msg = e.message || t('pgConnectFailed', lang);
        if (e.code === 'ECONNREFUSED') msg = t('pgConnRefused', lang);
        if (e.code === '28P01') msg = t('pgAuthFailed', lang);
        if (e.code === '3D000') msg = t('pgDbNotExist', lang);
        return res.status(400).json({ success: false, message: msg });
      }
    }

    return res.status(400).json({ success: false, message: t('dbTypeNotSupported', lang) });
  } catch (error: any) {
    console.error('[Setup] 测试数据库失败:', error);
    res.status(500).json({ success: false, message: error.message || t('testFailed', lang) });
  }
});

/**
 * POST /api/setup/test-email
 * 测试邮件 SMTP 连接
 */
router.post('/test-email', async (req: Request, res: Response) => {
  const lang = getLang(req);
  try {
    const isSetup = await SetupService.isSetupCompleted();
    if (isSetup) {
      return res.status(403).json({ success: false, message: t('systemAlreadyInitialized', lang) });
    }

    const { mail_host, mail_port, mail_user, mail_pass } = req.body;

    if (!mail_host || !mail_user || !mail_pass) {
      return res.status(400).json({ success: false, message: t('mailConfigIncomplete', lang) });
    }

    const transporter = nodemailer.createTransport({
      host: mail_host,
      port: parseInt(mail_port || '465'),
      secure: parseInt(mail_port || '465') === 465,
      auth: {
        user: mail_user,
        pass: mail_pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    try {
      await transporter.verify();
      return res.json({ success: true, message: t('smtpVerifySuccess', lang) });
    } catch (e: any) {
      let msg = e.message || t('smtpVerifyFailed', lang);
      if (e.code === 'EAUTH') msg = t('smtpAuthFailed', lang);
      if (e.code === 'ESOCKET') msg = t('smtpConnFailed', lang);
      if (e.code === 'ETIMEDOUT') msg = t('smtpTimeout', lang);
      return res.status(400).json({ success: false, message: msg });
    }
  } catch (error: any) {
    console.error('[Setup] 测试邮件失败:', error);
    res.status(500).json({ success: false, message: error.message || t('testFailed', lang) });
  }
});

/**
 * POST /api/setup/test-redis
 * 测试 Redis 连接
 */
router.post('/test-redis', async (req: Request, res: Response) => {
  const lang = getLang(req);
  try {
    const isSetup = await SetupService.isSetupCompleted();
    if (isSetup) {
      return res.status(403).json({ success: false, message: t('systemAlreadyInitialized', lang) });
    }

    const { redis_host, redis_port, redis_password } = req.body;

    const host = redis_host || 'localhost';
    const port = parseInt(redis_port || '6379');
    const password = redis_password || undefined;

    const client: RedisClientType = createClient({
      socket: { host, port, connectTimeout: 3000 },
      password,
    });

    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return res.json({ success: true, message: t('redisConnectSuccess', lang) });
    } catch (e: any) {
      let msg = e.message || t('redisConnectFailed', lang);
      if (e.code === 'ECONNREFUSED') msg = t('redisConnRefused', lang);
      if (e.code === 'ERR_UNKNOWN') msg = t('redisAuthFailed', lang);
      return res.status(400).json({ success: false, message: msg });
    }
  } catch (error: any) {
    console.error('[Setup] 测试 Redis 失败:', error);
    res.status(500).json({ success: false, message: error.message || t('testFailed', lang) });
  }
});

/**
 * POST /api/setup/complete
 * 完成安装（支持 SQLite / PostgreSQL 选择）
 * 字段：site_name, db_type, db_host, db_port, db_name, db_user, db_password,
 *       redis_enabled, redis_host, redis_port, redis_password,
 *       mail_host, mail_port, mail_user, mail_pass, mail_from,
 *       admin_username, admin_email, admin_password
 */
router.post('/complete', async (req: Request, res: Response) => {
  const lang = getLang(req);
  try {
    const {
      site_name,
      db_type = 'sqlite',
      db_host,
      db_port,
      db_name,
      db_user,
      db_password,
      redis_enabled = false,
      redis_host,
      redis_port,
      redis_password,
      mail_host,
      mail_port,
      mail_user,
      mail_pass,
      mail_from,
      admin_email,
      admin_password,
      admin_username,
    } = req.body;

    // 验证必填
    if (!admin_email || !admin_password) {
      return res.status(400).json({ success: false, message: t('emailPasswordRequired', lang) });
    }
    if (admin_password.length < 6) {
      return res.status(400).json({ success: false, message: t('passwordTooShort', lang) });
    }
    if (db_type === 'postgresql') {
      if (!db_host || !db_name || !db_user || !db_password) {
        return res.status(400).json({ success: false, message: t('pgInfoIncomplete', lang) });
      }
    }
    if (!mail_host || !mail_user || !mail_pass || !mail_from) {
      return res.status(400).json({ success: false, message: t('mailConfigIncomplete', lang) });
    }

    // 检查是否已安装
    const isSetup = await SetupService.isSetupCompleted();
    if (isSetup) {
      return res.status(403).json({ success: false, message: t('systemAlreadySetup', lang) });
    }

    const result = await SetupService.completeSetup({
      site_name: site_name || 'Minecraft Skin Server',
      db_type,
      db_host,
      db_port: db_port ? Number(db_port) : 5432,
      db_name,
      db_user,
      db_password,
      redis_enabled: redis_enabled === true || redis_enabled === 'true',
      redis_host: redis_enabled ? (redis_host || 'localhost') : undefined,
      redis_port: redis_enabled ? (redis_port ? Number(redis_port) : 6379) : undefined,
      redis_password: redis_enabled ? (redis_password || undefined) : undefined,
      mail_host,
      mail_port: mail_port ? Number(mail_port) : 465,
      mail_user,
      mail_pass,
      mail_from,
      admin_email,
      admin_password,
      admin_username: admin_username || admin_email.split('@')[0],
    });

    res.status(200).json({
      success: true,
      message: t('setupComplete', lang),
      user: {
        user_uid: result.user.user_uid,
        email: result.user.email,
        username: result.user.username,
        role: result.user.role,
        level: result.user.level,
      }
    });
  } catch (error: any) {
    console.error('[Setup] 安装失败:', error);
    res.status(500).json({ success: false, message: error.message || t('installFailed', lang) });
  }
});

export default router;
