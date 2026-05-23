-- 创建数据库（需要手动创建databse skin_server）
-- CREATE DATABASE skin_server;

-- 使用数据库
-- \c skin_server;

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid SERIAL UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
    level INTEGER DEFAULT 0 CHECK (level IN (0, 1, 2)),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    banned_until VARCHAR(20),
    username VARCHAR(255),
    verification_token VARCHAR(64),
    verification_expires TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_uid ON users(user_uid);
CREATE INDEX idx_users_level ON users(level);

-- ============================================
-- 2. 角色表 (profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(16) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skin_id VARCHAR(50),
    cape_id VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_name ON profiles(name);

-- ============================================
-- 3. 皮肤表 (skins)
-- ============================================
CREATE TABLE IF NOT EXISTS skins (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    file_path VARCHAR(255) NOT NULL,
    model_type VARCHAR(10) DEFAULT 'default' CHECK (model_type IN ('default', 'slim')),
    name VARCHAR(50),
    original_name VARCHAR(255),
    file_hash VARCHAR(64) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL DEFAULT 64,
    height INTEGER NOT NULL DEFAULT 64,
    description TEXT,
    license_type VARCHAR(20) DEFAULT 'ARR' CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'GPLv3', 'Custom')),
    permission_level VARCHAR(30) DEFAULT 'private' CHECK (permission_level IN ('private', 'public_no_download', 'public_downloadable')),
    is_public BOOLEAN DEFAULT FALSE,
    is_downloadable BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skins_user_id ON skins(user_id);
CREATE INDEX idx_skins_profile_id ON skins(profile_id);
CREATE INDEX idx_skins_file_hash ON skins(file_hash);
CREATE INDEX idx_skins_permission_level ON skins(permission_level);
CREATE INDEX idx_skins_approval_status ON skins(approval_status);
CREATE INDEX idx_skins_created_at ON skins(created_at DESC);

-- ============================================
-- 3b. 披风表 (capes)
-- ============================================
CREATE TABLE IF NOT EXISTS capes (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL DEFAULT 22,
    height INTEGER NOT NULL DEFAULT 17,
    name VARCHAR(50),
    description TEXT,
    license_type VARCHAR(20) DEFAULT 'ARR' CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'GPLv3', 'Custom')),
    permission_level VARCHAR(30) DEFAULT 'private' CHECK (permission_level IN ('private', 'public_no_download', 'public_downloadable')),
    is_public BOOLEAN DEFAULT FALSE,
    is_downloadable BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_capes_user_id ON capes(user_id);
CREATE INDEX idx_capes_approval_status ON capes(approval_status);

-- ============================================
-- 4. 标签表 (skin_tags)
-- ============================================
CREATE TABLE IF NOT EXISTS skin_tags (
    id SERIAL PRIMARY KEY,
    skin_id VARCHAR(50) NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skin_id, tag)
);

CREATE INDEX idx_skin_tags_skin_id ON skin_tags(skin_id);
CREATE INDEX idx_skin_tags_tag ON skin_tags(tag);

-- ============================================
-- 5. 令牌表 (tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS tokens (
    access_token VARCHAR(64) PRIMARY KEY,
    client_token VARCHAR(64),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE INDEX idx_tokens_user_id ON tokens(user_id);
CREATE INDEX idx_tokens_expires_at ON tokens(expires_at);

-- ============================================
-- 6. 会话表 (sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    server_id VARCHAR(64) PRIMARY KEY,
    access_token VARCHAR(64) NOT NULL REFERENCES tokens(access_token) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id),
    client_ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_sessions_access_token ON sessions(access_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- 6b. 黑名单表 (blacklist)
-- ============================================
CREATE TABLE IF NOT EXISTS blacklist (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    ip_address VARCHAR(45),
    ban_type VARCHAR(20) NOT NULL DEFAULT 'permanent' CHECK (ban_type IN ('permanent', 'temporary')),
    ban_until TIMESTAMP,
    reason TEXT,
    banned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blacklist_email ON blacklist(email);
CREATE INDEX idx_blacklist_ip ON blacklist(ip_address);
CREATE INDEX idx_blacklist_ban_type ON blacklist(ban_type);
CREATE INDEX idx_blacklist_ban_until ON blacklist(ban_until);

-- ============================================
-- 7. 系统配置表 (system_config)
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化配置
INSERT INTO system_config (key, value, description) VALUES
('setup_completed', 'false', '系统是否已初始化'),
('site_name', 'Minecraft Skin Server', '站点名称'),
('site_url', 'http://localhost:3000', '站点URL'),
('allow_registration', 'true', '是否允许注册'),
('require_email_verification', 'true', '是否需要邮箱验证'),
('enable_captcha', 'true', '是否启用人机验证'),
('default_skin_permission', 'private', '默认皮肤权限'),
('max_file_size_mb', '1', '最大文件大小（MB）'),
('allowed_dimensions', '64x64,64x32', '允许的图片尺寸')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 8. 创建外键约束（在表创建后添加）
-- ============================================
ALTER TABLE profiles 
  ADD CONSTRAINT fk_profiles_skin 
  FOREIGN KEY (skin_id) REFERENCES skins(id) ON DELETE SET NULL;

ALTER TABLE profiles 
  ADD CONSTRAINT fk_profiles_cape 
  FOREIGN KEY (cape_id) REFERENCES capes(id) ON DELETE SET NULL;

-- ============================================
-- 9. 创建视图（方便查询）
-- ============================================
CREATE OR REPLACE VIEW v_user_profiles AS
SELECT 
    u.user_uid,
    u.email,
    u.role,
    u.level,
    p.id as profile_uuid,
    p.name as profile_name,
    p.skin_id,
    p.cape_id
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id;

CREATE OR REPLACE VIEW v_skin_library AS
SELECT 
    s.id as skin_id,
    s.user_id,
    u.user_uid,
    u.email as uploader_email,
    s.profile_id,
    s.file_path,
    s.model_type,
    s.description,
    s.license_type,
    s.permission_level,
    s.is_public,
    s.is_downloadable,
    s.approval_status,
    s.download_count,
    s.view_count,
    s.created_at
FROM skins s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.approval_status = 'approved' AND s.is_public = TRUE;
