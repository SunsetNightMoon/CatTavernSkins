import { DB, DB as DBInstance } from '../config/database'
import { hashPassword } from '../utils/crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { generateUUID, generateOfflineUUID } from '../utils/uuid'

export class SetupService {
  /**
   * 检查系统是否已初始化
   */
  static async isSetupCompleted(): Promise<boolean> {
    try {
      const result = await DB.query(
        `SELECT value FROM system_config WHERE key = $1`,
        ['setup_completed']
      )
      return result.rows[0]?.value === 'true'
    } catch {
      return false
    }
  }

  /**
   * 清理数据库中的所有表数据（用于重新初始化）
   */
  private static async resetDatabase(): Promise<void> {
    const tables = ['cape_favorites', 'skin_favorites', 'sessions', 'tokens', 'blacklist', 'capes', 'skins', 'profiles', 'users', 'system_config']
    try {
      for (const table of tables) {
        await DB.query(`DROP TABLE IF EXISTS ${table}`)
      }
      console.log('[Setup] 数据库表已清理')
    } catch (e: any) {
      console.warn('[Setup] 清理数据库表失败:', e.message)
    }
  }

  /**
   * 创建超级管理员（level 2）
   * 如果用户已存在，先删除旧用户
   */
  static async createSuperAdmin(
    email: string,
    password: string,
    username?: string
  ): Promise<any> {
    const password_hash = await hashPassword(password)
    const displayName = username || email.split('@')[0]

    // 检查并删除已存在的用户（避免 UNIQUE 冲突）
    try {
      const existing = await DB.query(
        'SELECT id FROM users WHERE email = $1 LIMIT 1',
        [email]
      )
      if (existing.rows.length > 0) {
        console.log('[Setup] 删除已存在的用户:', email)
        const oldUserId = existing.rows[0].id
        await DB.query('DELETE FROM profiles WHERE user_id = $1', [oldUserId])
        await DB.query('DELETE FROM users WHERE id = $1', [oldUserId])
      }
    } catch (e: any) {
      console.warn('[Setup] 检查旧用户失败:', e.message)
    }

    // 获取下一个 user_uid（从1开始自增）
    const dbType = process.env.DB_TYPE || 'sqlite';
    const id = generateUUID();
    let userResult;
    if (dbType === 'sqlite') {
      const uidResult = await DB.query(
        'SELECT COALESCE(MAX(user_uid), 0) + 1 as next_uid FROM users'
      );
      const userUid = uidResult.rows[0]?.next_uid || 1;
      userResult = await DB.query(
        `INSERT INTO users (id, user_uid, email, password_hash, role, level, email_verified)
         VALUES ($1, $2, $3, $4, 'super_admin', 2, 1)
         RETURNING *`,
        [id, userUid, email, password_hash]
      );
    } else {
      userResult = await DB.query(
        `INSERT INTO users (id, email, password_hash, role, level, email_verified)
         VALUES ($1, $2, $3, 'super_admin', 2, true)
         RETURNING *`,
        [id, email, password_hash]
      );
    }

    const user = userResult.rows[0]
    const profileId = generateOfflineUUID(displayName);

    const profileResult = await DB.query(
      `INSERT INTO profiles (id, user_id, name, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
       [profileId, user.id, displayName, dbType === 'sqlite' ? 1 : true]
    )

    return { ...user, profile: profileResult.rows[0] }
  }

  /**
   * 完成安装
   * 支持 SQLite / PostgreSQL 选择
   */
  static async completeSetup(config: {
    site_name?: string
    db_type?: 'sqlite' | 'postgresql'
    db_host?: string
    db_port?: number
    db_name?: string
    db_user?: string
    db_password?: string
    mail_host?: string
    mail_port?: number
    mail_user?: string
    mail_pass?: string
    mail_from?: string
    admin_email: string
    admin_password: string
    admin_username?: string
  }): Promise<{ success: boolean; user: any }> {
    const dbType = config.db_type || 'sqlite'
    const isProd = process.env.NODE_ENV === 'production'

    // 立即更新 process.env，使 getDbType() 和 getPgPool() 能读到正确的值
    process.env.DB_TYPE = dbType

    // 如果切换到 PostgreSQL，立即用前端传来的配置更新 process.env，并重置旧连接池
    if (dbType === 'postgresql') {
      if (config.db_host) process.env.DB_HOST = config.db_host
      if (config.db_port) process.env.DB_PORT = String(config.db_port)
      if (config.db_name) process.env.DB_DATABASE = config.db_name
      if (config.db_user) process.env.DB_USER = config.db_user
      if (config.db_password) process.env.DB_PASSWORD = config.db_password
      // 关闭旧 Pool（如有），下次 getPgPool() 会用新配置重建
      await DB.resetPostgresPool()
    } else {
      // 切换到 SQLite，关闭 PostgreSQL 连接池（如有）
      await DB.resetPostgresPool()
    }

    // 1. 检查是否需要重新初始化
    const isSetup = await this.isSetupCompleted().catch(() => false)
    if (!isSetup) {
      console.log('[Setup] 系统未初始化，准备清理并重建数据库')
      if (dbType === 'sqlite') {
        await DBInstance.resetSQLite()
      }
      await this.resetDatabase()
    }

    // 2. 确保 data 目录存在（仅 SQLite）
    if (dbType === 'sqlite') {
      const dbPath = './data/skin_server.db'
      await fs.mkdir(path.dirname(dbPath), { recursive: true }).catch(() => {})
    }

    // 3. 写入 .env
    const envPath = path.resolve(process.cwd(), '.env')
    let envContent = await fs.readFile(envPath, 'utf-8').catch(() => '')

    const envUpdates: Record<string, string> = {
      NODE_ENV: isProd ? 'production' : 'development',
      DB_TYPE: dbType,
      PORT: '3000',
      JWT_SECRET: require('crypto').randomBytes(32).toString('hex'),
    }

    if (dbType === 'sqlite') {
      envUpdates.DB_PATH = './data/skin_server.db'
    } else {
      if (config.db_host) envUpdates.DB_HOST = config.db_host
      if (config.db_port) envUpdates.DB_PORT = String(config.db_port)
      if (config.db_name) envUpdates.DB_DATABASE = config.db_name
      if (config.db_user) envUpdates.DB_USER = config.db_user
      if (config.db_password) envUpdates.DB_PASSWORD = config.db_password
    }

    // 邮箱配置（网易邮箱模板）
    if (config.mail_host) envUpdates.MAIL_HOST = config.mail_host
    if (config.mail_port) envUpdates.MAIL_PORT = String(config.mail_port)
    if (config.mail_user) envUpdates.MAIL_USER = config.mail_user
    if (config.mail_pass) envUpdates.MAIL_PASS = config.mail_pass
    if (config.mail_from) envUpdates.MAIL_FROM = config.mail_from
    // 默认使用 465 端口对应 SSL
    envUpdates.MAIL_SECURE = config.mail_port === 465 ? 'true' : 'false'

    for (const [key, value] of Object.entries(envUpdates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`)
      } else {
        envContent += `\n${key}=${value}`
      }
    }

    await fs.writeFile(envPath, envContent.trim() + '\n')

    // 4. 更新 process.env（使当前进程生效）
    for (const [key, value] of Object.entries(envUpdates)) {
      process.env[key] = value
    }

    // 4.5 重置 PostgreSQL 连接池，确保使用最终配置
    if (dbType === 'postgresql') {
      await DB.resetPostgresPool()
    }

    // 5. 建表
    await this.createTables()

    // 6. 创建超级管理员
    const user = await this.createSuperAdmin(
      config.admin_email,
      config.admin_password,
      config.admin_username
    )

    // 7. 写入初始配置
    if (dbType === 'sqlite') {
      await DB.query(
        `INSERT OR REPLACE INTO system_config (key, value) VALUES ($1, $2)`,
        ['setup_completed', 'true']
      );
      await DB.query(
        `INSERT OR REPLACE INTO system_config (key, value) VALUES ($1, $2)`,
        ['site_name', config.site_name || 'Minecraft Skin Server']
      );
    } else {
      await DB.query(
        `INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        ['setup_completed', 'true']
      );
      await DB.query(
        `INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        ['site_name', config.site_name || 'Minecraft Skin Server']
      );
    }

    console.log('[Setup] 安装完成！')
    return { success: true, user }
  }

  /**
   * 创建数据库表
   * PostgreSQL: 执行迁移 SQL 文件，确保与手动迁移路径的 schema 完全一致
   * SQLite: 使用内联 DDL（保持向后兼容）
   */
  private static async createTables(): Promise<void> {
    const dbType = process.env.DB_TYPE || 'sqlite'

    if (dbType === 'postgresql') {
      const migrationDir = path.resolve(process.cwd(), 'database', 'migrations');
      const pgMigrations = [
        '001-init-postgres.sql',
        '007-add-favorites-table-postgres.sql',
      ];
      for (const file of pgMigrations) {
        const filePath = path.resolve(migrationDir, file);
        const sql = await fs.readFile(filePath, 'utf-8');
        // 按语句分割执行：先按 ; 分块，再移除每个块内的注释行
        const statements = sql
          .split(';')
          .map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
          .filter(s => s.length > 0);
        for (const stmt of statements) {
          try {
            await DB.query(stmt);
          } catch (e: any) {
            console.error(`[Setup] 迁移执行失败 [${file}]:`, e.message);
            throw e;
          }
        }
      }
      return;
    }

    // SQLite: 使用内联 DDL
    const tables = [
      // users 表
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid INTEGER UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        level INTEGER DEFAULT 0,
        email_verified INTEGER DEFAULT 0,
        banned_until TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // profiles 表
      `CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT UNIQUE NOT NULL,
        is_default INTEGER DEFAULT 0,
        name_changed_at TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // skins 表 —— 与 Skin.ts 模型字段完全对齐
      `CREATE TABLE IF NOT EXISTS skins (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        original_name TEXT,
        model_type TEXT DEFAULT 'default',
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        name TEXT,
        description TEXT,
        license_type TEXT DEFAULT 'default',
        permission_level TEXT DEFAULT 'private',
        is_public INTEGER DEFAULT 0,
        is_downloadable INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        rejected_by TEXT,
        rejection_reason TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // capes 表 —— 与 Cape.ts 模型字段完全对齐
      `CREATE TABLE IF NOT EXISTS capes (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        original_name TEXT,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        name TEXT,
        description TEXT,
        license_type TEXT DEFAULT 'default',
        permission_level TEXT DEFAULT 'private',
        is_public INTEGER DEFAULT 0,
        is_downloadable INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        rejected_by TEXT,
        rejection_reason TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // system_config 表
      `CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // blacklist 表
      `CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        ip_address TEXT,
        ban_type TEXT DEFAULT 'temporary',
        ban_until TEXT,
        reason TEXT,
        banned_by TEXT NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // tokens 表
      `CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        client_token TEXT,
        user_id TEXT NOT NULL,
        profile_id TEXT,
        expires_at TEXT,
        token_type TEXT DEFAULT 'access',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`,
      // sessions 表
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        expires_at TEXT
      )`,
      // skin_favorites 表
      `CREATE TABLE IF NOT EXISTS skin_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        skin_id TEXT NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        UNIQUE(user_id, skin_id)
      )`,
      // cape_favorites 表
      `CREATE TABLE IF NOT EXISTS cape_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        cape_id TEXT NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        UNIQUE(user_id, cape_id)
      )`,
    ]

    for (const sql of tables) {
      try {
        await DB.query(sql)
      } catch (e: any) {
        console.error('[Setup] 建表失败:', e.message)
        throw e
      }
    }

    // 确保所有表包含必要列（兼容旧表结构）
    await this.ensureAllColumns()
  }

  /**
   * 检查并添加所有表缺失的列
   * 仅对 SQLite 执行，PostgreSQL 建表时已包含所有字段
   */
  private static async ensureAllColumns(): Promise<void> {
    const dbType = process.env.DB_TYPE || 'sqlite'
    if (dbType !== 'sqlite') return

    const tableColumns: Record<string, Record<string, string>> = {
      users: {
        username: 'TEXT',
        banned_until: 'TEXT',
        email_verified: 'INTEGER DEFAULT 0',
      },
      profiles: {
        is_default: 'INTEGER DEFAULT 0',
        name_changed_at: 'TEXT',
      },
      skins: {
        original_name: 'TEXT',
        model_type: "TEXT DEFAULT 'default'",
        file_size: 'INTEGER',
        width: 'INTEGER',
        height: 'INTEGER',
        name: 'TEXT',
        description: 'TEXT',
        license_type: "TEXT DEFAULT 'default'",
        permission_level: "TEXT DEFAULT 'private'",
        is_public: 'INTEGER DEFAULT 0',
        is_downloadable: 'INTEGER DEFAULT 0',
        views: 'INTEGER DEFAULT 0',
        likes: 'INTEGER DEFAULT 0',
        download_count: 'INTEGER DEFAULT 0',
        view_count: 'INTEGER DEFAULT 0',
        approval_status: "TEXT DEFAULT 'pending'",
        approved_by: 'TEXT',
        approved_at: 'TEXT',
        rejected_by: 'TEXT',
        rejection_reason: 'TEXT',
      },
      capes: {
        original_name: 'TEXT',
        file_size: 'INTEGER',
        width: 'INTEGER',
        height: 'INTEGER',
        name: 'TEXT',
        description: 'TEXT',
        license_type: "TEXT DEFAULT 'default'",
        permission_level: "TEXT DEFAULT 'private'",
        is_public: 'INTEGER DEFAULT 0',
        is_downloadable: 'INTEGER DEFAULT 0',
        views: 'INTEGER DEFAULT 0',
        likes: 'INTEGER DEFAULT 0',
        download_count: 'INTEGER DEFAULT 0',
        view_count: 'INTEGER DEFAULT 0',
        approval_status: "TEXT DEFAULT 'pending'",
        approved_by: 'TEXT',
        approved_at: 'TEXT',
        rejected_by: 'TEXT',
        rejection_reason: 'TEXT',
      },
    }

    try {
      const db = await DB.getConnection()

      for (const [table, columns] of Object.entries(tableColumns)) {
        try {
          const rows: any[] = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(${table})`, (err: any, rows: any[]) => {
              if (err) reject(err)
              else resolve(rows)
            })
          })
          const existingColumns = new Set(rows.map((r: any) => r.name))

          for (const [column, type] of Object.entries(columns)) {
            if (!existingColumns.has(column)) {
              console.log(`[Setup] 添加缺失列: ${table}.${column}`)
              await DB.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
            }
          }
        } catch (e: any) {
          console.warn(`[Setup] 检查 ${table} 表失败:`, e.message)
        }
      }
    } catch (e: any) {
      console.warn('[Setup] 获取数据库连接失败:', e.message)
    }
  }
}
