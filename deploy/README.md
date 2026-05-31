# 生产部署指南

本目录包含 Linux 服务器的生产部署配置，包括纯 Linux 原生部署和 Docker 部署两种方式。

---

## 方式 A：Docker 部署（推荐）

适合：Linux 服务器，一键部署

### 前置要求

- Docker 20+
- Docker Compose 2+
- 域名（如需 HTTPS）

### 快速部署

```bash
# 1. 进入部署目录
cd /opt/minecraft-skin-server/deploy

# 2. 创建 .env 配置文件
cp ../.env.example .env
# 编辑 .env，设置以下关键配置：
#   DB_TYPE=postgres
#   DB_HOST=postgres
#   DB_USER=postgres
#   DB_PASSWORD=<your_strong_password>
#   DB_DATABASE=skin_server
#   JWT_SECRET=<your_random_secret>
#   BASE_URL=https://skin.example.com

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f app
```

### 配置说明

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `DB_TYPE` | 数据库类型 | `postgres` |
| `DB_HOST` | PostgreSQL 主机 | `postgres` |
| `DB_PORT` | PostgreSQL 端口 | `5432` |
| `DB_DATABASE` | 数据库名 | `skin_server` |
| `DB_USER` | 数据库用户 | `postgres` |
| `DB_PASSWORD` | 数据库密码 | （必填） |
| `JWT_SECRET` | JWT 密钥 | （必填） |
| `BASE_URL` | 站点 URL | `http://localhost:3000` |
| `REDIS_HOST` | Redis 主机 | `redis` |
| `ALLOW_REGISTRATION` | 允许注册 | `true` |
| `STORAGE_TYPE` | 存储方式：`local` 或 `s3` | `local` |
| `S3_*` | S3/MinIO 配置（`STORAGE_TYPE=s3` 时） | 见 `.env.example` |
| `MICROSOFT_CLIENT_ID` / `_SECRET` | Microsoft 登录（可选） | 空 |
| `OAUTH_CALLBACK_BASE_URL` | OAuth 回调基址，须与 Azure 重定向 URI 一致 | `BASE_URL` |
| `TURNSTILE_SITE_KEY` / `_SECRET_KEY` | Cloudflare Turnstile（可选） | 空 |
| `ENABLE_SWAGGER` | `/api-docs` Swagger UI（生产建议 `false`） | `false` |

> 注意：生产用 HTTPS 时 `BASE_URL` 须为 `https://`，会话 Cookie 才会带 `Secure` 标志。后端已设 `trust proxy`，反代须透传 `X-Forwarded-Proto`（下方 Nginx 配置已包含）。

### 数据持久化

Docker Compose 配置了以下卷挂载：

| 主机路径 | 容器路径 | 说明 |
|----------|----------|------|
| `../uploads` | `/app/uploads` | 皮肤和披风文件 |
| `../keys` | `/app/keys` | RSA 密钥对 |
| `../data` | `/app/data` | SQLite 数据库（如使用） |
| `../logs` | `/app/logs` | 日志文件 |
| `postgres_data`（卷） | `/var/lib/postgresql/data` | PostgreSQL 数据 |

### Nginx / OpenResty 反向代理

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name skin.example.com;

    # SSL 配置
    ssl_certificate /etc/nginx/ssl/skin.example.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/skin.example.com/privkey.pem;

    # 强制 HTTPS
    if ($scheme = http) {
        return 301 https://$server_name$request_uri;
    }

    # 允许大文件上传
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 仅当 STORAGE_TYPE=local 时，可由 Nginx 直接提供静态纹理文件以减轻后端压力。
    # ⚠️ 若 STORAGE_TYPE=s3：删除此 location，让 /uploads/ 走上面的 proxy_pass 到后端，
    #    由后端代理路由从对象存储拉取（本地磁盘没有这些文件，alias 会导致 404）。
    location /uploads/ {
        alias /opt/minecraft-skin-server/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 管理命令

```bash
# 重启服务
docker-compose restart

# 更新并重启
git pull && docker-compose up -d --build

# 停止服务
docker-compose down

# 查看状态
docker-compose ps

# 进入后端容器
docker-compose exec app sh
```

### Let's Encrypt 证书

```bash
# 使用 certbot 申请证书
certbot --nginx -d skin.example.com
```

---

## 方式 B：纯 Linux 部署

适合：有 Linux 服务器管理经验，希望直接运行 Node.js

### 前置要求

- Node.js 18+
- PostgreSQL 16+（或使用 SQLite）
- Redis 7（可选）
- Nginx / OpenResty

### 安装步骤

```bash
# 1. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 3. 创建数据库
sudo -u postgres psql
CREATE DATABASE skin_server;
CREATE USER skin_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE skin_server TO skin_user;
\q

# 4. 克隆项目
sudo mkdir -p /opt/minecraft-skin-server
sudo git clone <repo-url> /opt/minecraft-skin-server
cd /opt/minecraft-skin-server
sudo chown -R $USER:$USER .

# 5. 安装依赖
npm install --production
cd frontend && npm install --production && cd ..

# 6. 配置环境变量
cp .env.example .env
nano .env
# 设置 DB_TYPE=postgres 及数据库连接信息

# 7. 生成 RSA 密钥
npm run generate-keys

# 8. 运行数据库迁移
npm run migrate

# 9. 构建前端
cd frontend && npm run build && cd ..

# 10. 使用 PM2 运行
npm install -g pm2
pm2 start dist/server.js --name skin-server
pm2 startup
pm2 save

# 11. 配置 Nginx（见上方配置）
sudo nano /etc/nginx/sites-available/skin-server
sudo ln -s /etc/nginx/sites-available/skin-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### systemd 服务（可选）

```ini
# /etc/systemd/system/skin-server.service
[Unit]
Description=Minecraft Skin Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/minecraft-skin-server
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable skin-server
sudo systemctl start skin-server
```

---

## 数据库迁移

通常**无需手动迁移**：

- 首次部署时，安装向导（`/setup`）完成初始化时会自动建表（PostgreSQL 会按编号执行 `database/migrations/` 下全部 `-postgres.sql`；SQLite 用内置 DDL）。
- 已有部署升级时，运行 `npm run migrate` 会按编号依次执行所有迁移；每个迁移在事务中执行，失败自动回滚，可安全重复运行（幂等）。SQLite 旧库的 INTEGER 主键会在执行 010 前自动转换为字符串 ID（已是字符串则跳过）。

```bash
# 升级已有数据库（在容器内或项目根目录执行）
npm run migrate

# Docker 部署：
docker-compose exec app npm run migrate
```

> 不要再手动 `psql -f 001-init-postgres.sql` 单独导入——那会遗漏后续迁移（AI 字段、oauth_accounts 表等），导致 OAuth/AI 等功能在全新库上报错。
