# CatTavernSkins

Yggdrasil API 兼容的 Minecraft 皮肤站系统，支持自定义前端、多数据库和多平台部署。

> **主线开发环境**：Windows + SQLite（零配置，开箱即用）

---

## 快速开始（Windows + SQLite）

双击运行，5 分钟即可启动：

```bash
# 在项目根目录下双击运行
start.bat

# 或在命令行中
.\start.bat
```

脚本会自动完成：
- 检查 Node.js 环境
- 安装前后端依赖
- 生成 RSA 密钥对
- 初始化 SQLite 数据库
- 启动前端（http://localhost:5174）和后端（http://localhost:3000）

**首次使用**：
1. 访问 http://localhost:5174/setup 完成初始化向导
2. 第一个注册的用户自动成为超级管理员（level 2）

---

## 项目结构

```
minecraft-skin-server/
├── start.bat              # Windows 启动脚本（主线入口）
├── deploy/                # 生产部署配置
│   ├── start-linux.sh    # Linux 启动脚本
│   ├── docker-compose.yml# Docker Compose
│   └── Dockerfile         # Docker 镜像
├── database/
│   └── migrations/
│       ├── 001-init-sqlite.sql   # 开发用
│       └── 001-init-postgres.sql # 生产用
├── src/                   # 后端源码
├── frontend/              # React 前端
├── uploads/               # 上传文件
│   ├── skins/
│   └── capes/
└── keys/                  # RSA 密钥（自动生成）
```

---

## 部署方式

### 方式1：Windows 本地开发（主线）

> 零配置，适合日常开发和调试

**前置要求**：Node.js 18+

```bash
.\start.bat
```

访问 http://localhost:5174

---

### 方式2：Linux 本地开发

> 适合 Linux 桌面开发者

**前置要求**：Node.js 18+

```bash
chmod +x deploy/start-linux.sh
./deploy/start-linux.sh
```

---

### 方式3：Docker 部署（生产环境）

> 适合 Linux 服务器，一键部署

**前置要求**：Docker + Docker Compose

```bash
cd deploy

# 编辑 .env 配置数据库
# DB_TYPE=postgres（生产推荐）
# DB_USER=postgres
# DB_PASSWORD=your_password

docker-compose up -d
```

**配置反向代理（Nginx/OpenResty）**：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name skin.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /path/to/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 数据库配置

默认使用 **SQLite**，无需安装任何数据库软件。

### 切换到 PostgreSQL

```bash
# 1. 安装 PostgreSQL（或使用 Docker）
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=password postgres:16

# 2. 编辑 .env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=skin_server
DB_USER=postgres
DB_PASSWORD=password

# 3. 运行迁移
npm run migrate
```

> 注意：不支持从 SQLite 直接迁移到 PostgreSQL，需手动导出导入数据。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 + Three.js |
| 后端 | Node.js + TypeScript + Express |
| 数据库 | SQLite 3（开发）/ PostgreSQL 16+（生产） |
| 缓存 | Redis 7（可选） |
| 部署 | Docker + Docker Compose |

---

## 已实现功能

### Yggdrasil API

| 端点 | 说明 |
|------|------|
| `POST /authserver/authenticate` | 用户登录 |
| `POST /authserver/refresh` | 刷新令牌 |
| `POST /authserver/validate` | 验证令牌 |
| `POST /authserver/invalidate` | 吊销令牌 |
| `POST /authserver/signout` | 登出 |
| `GET /sessionserver/session/minecraft/hasJoined` | 服务器验证客户端 |
| `GET /sessionserver/session/minecraft/profile/:uuid` | 查询角色属性 |
| `PUT /api/user/profile/:uuid/:textureType` | 上传皮肤/披风 |
| `DELETE /api/user/profile/:uuid/:textureType` | 删除材质 |

### Web 管理

- 用户注册 / 登录（邮箱验证）
- 本地人机验证（算术题，无外部依赖；计划替换为 Cloudflare Turnstile）
- 皮肤库（参考 NameMC 设计）
- 3D 皮肤预览（Three.js）
- 权限级别：私有 / 公开不可下载 / 公开可下载
- 协议选择：CC 0/3.0/4.0、ARR、AI CC0
- 管理员层级：超级管理员（level 2）→ 管理员（level 1）→ 用户（level 0）
- 用户 UID 系统（自增整数）
- 图片验证（PNG + ≤1MB + 尺寸检查 + SHA-256 去重）

---

## API 使用示例

```bash
# 注册（必须提供 profile_name）
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"123456","profile_name":"Steve2024","captcha_session_id":"xxx","captcha_answer":42}'

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"123456"}'

# Yggdrasil 认证（Minecraft 客户端）
curl -X POST http://localhost:3000/authserver/authenticate \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"123456","clientToken":"xxx","agent":{"name":"Minecraft","version":1}}'
```

### Minecraft 服务器配置（authlib-injector）

```bash
java -jar -javaagent:authlib-injector.jar=https://skin.example.com \
  spigot.jar
```

`server.properties` 中设置 `online-mode=true`。

---

## 安全特性

- 密码 bcrypt 加密
- RSA 密钥对签名验证（textures 属性）
- 速率限制（登录、上传）
- PNG 图片格式验证 + SHA-256 去重
- 文件大小限制（≤1MB）+ 尺寸检查（64x32 或 64x64）
- Helmet.js 安全头 + CORS 配置

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_TYPE` | `sqlite` | 数据库类型：`sqlite` 或 `postgres` |
| `DB_PATH` | `./data/skin_server.db` | SQLite 数据库路径 |
| `DB_HOST` | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `DB_DATABASE` | `skin_server` | 数据库名 |
| `PORT` | `3000` | 服务端口 |
| `ALLOW_REGISTRATION` | `true` | 是否允许注册 |
| `ENABLE_CAPTCHA` | `true` | 是否启用人机验证 |
| `REQUIRE_EMAIL_VERIFICATION` | `true` | 是否需要邮箱验证 |

---

## 开发计划

- [x] SQLite 支持（Windows 零配置）
- [x] PostgreSQL 支持（生产）
- [x] Yggdrasil API 完整实现
- [x] 3D 皮肤预览
- [x] 管理员面板
- [x] 邮箱验证 + 本地人机验证
- [ ] Cloudflare 防护集成
  - [ ] 注册/登录等验证场景：Turnstile Managed 模式（Cloudflare 根据风险自动决定是否弹出质询）
  - [ ] 全站其它页面：Turnstile Invisible 模式（无感运行，异常行为时触发 JS 质询）
- [ ] OAuth 2.0（GitHub / Microsoft）
- [ ] S3 / MinIO 对象存储
- [ ] Swagger API 文档
- [ ] 单元测试

---

## 参考

- [Yggdrasil 技术规范](https://yushijinhun.github.io/authlib-injector/zh/Yggdrasil-%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83.html)
- [authlib-injector](https://github.com/yushijinhun/authlib-injector)
- [BlessingSkin](https://github.com/bs-community/blessing-skin-server)
- [LittleSkin](https://littlesk.in/)
