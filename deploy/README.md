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

PostgreSQL 迁移文件位于 `../database/migrations/001-init-postgres.sql`。

```bash
# 手动运行迁移
sudo -u postgres psql -d skin_server -f ../database/migrations/001-init-postgres.sql
```
