# 开发指南

本文档面向日常开发，介绍项目结构、开发流程和常见问题。

> **主线开发环境**：Windows + SQLite

---

## 环境要求

- Windows 10/11
- Node.js 18+
- Git

---

## 快速开始

### 1. 克隆项目

```bash
cd G:\Skin2.catnight.top
git clone <your-repo-url> minecraft-skin-server
cd minecraft-skin-server
```

### 2. 一键启动

```bash
# 双击或命令行运行
.\start.bat
```

脚本会自动完成：安装依赖 → 生成密钥 → 初始化数据库 → 启动前后端。

访问 http://localhost:5174

---

## 项目结构

```
minecraft-skin-server/
├── start.bat              # Windows 启动入口
│
├── deploy/                # 生产部署
│   ├── start-linux.sh    # Linux 启动脚本
│   ├── docker-compose.yml # Docker 部署
│   ├── Dockerfile
│   └── README.md          # 部署文档
│
├── src/                   # 后端
│   ├── api/              # 路由处理
│   │   ├── web/          # Web 端 API
│   │   └── yggdrasil/    # Yggdrasil API
│   ├── config/           # 配置
│   │   ├── database.ts   # 数据库抽象层（PostgreSQL/SQLite）
│   │   ├── cache.ts      # Redis 缓存
│   │   └── mail.ts       # 邮件服务
│   ├── middleware/        # 中间件
│   ├── models/           # 数据模型（User, Skin, Profile, Token）
│   ├── services/         # 业务逻辑
│   ├── scripts/          # 工具脚本
│   │   ├── migrate.ts    # 数据库迁移
│   │   └── generate-keys.ts
│   ├── types/            # TypeScript 类型定义
│   ├── utils/            # 工具函数（crypto, image, uuid）
│   ├── app.ts            # Express 路由注册
│   └── server.ts         # 服务入口
│
├── frontend/              # 前端（React）
│   └── src/
│       ├── components/    # 通用组件
│       │   ├── Layout/
│       │   └── Skin3DViewer/  # Three.js 3D 预览
│       ├── pages/
│       │   ├── Auth/          # 登录 / 注册
│       │   ├── Library/       # 皮肤库
│       │   ├── SkinDetail/    # 皮肤详情 + 3D 预览
│       │   ├── Upload/        # 上传皮肤
│       │   ├── Profile/       # 个人中心
│       │   ├── Admin/         # 管理员面板
│       │   └── Setup/         # 安装向导
│       ├── services/     # API 调用
│       ├── store/        # Zustand 状态管理
│       └── types/        # 类型定义
│
├── database/
│   └── migrations/
│       ├── 001-init-sqlite.sql   # 开发用
│       └── 001-init-postgres.sql # 生产用
│
├── uploads/              # 上传文件（gitignore）
│   ├── skins/
│   └── capes/
│
├── keys/                 # RSA 密钥（gitignore）
│
├── data/                 # SQLite 数据库（gitignore）
│
├── package.json
└── tsconfig.json
```

---

## 数据库

### 工作原理

`src/config/database.ts` 是数据库抽象层（`DB` 类），自动根据 `.env` 中的 `DB_TYPE` 选择：

| DB_TYPE | 驱动 | 适用场景 |
|---------|------|----------|
| `sqlite` | `sqlite3` + `sqlite` | Windows 开发（默认） |
| `postgres` | `pg` | Linux 开发 / 生产 |

**SQL 占位符自动转换**：PostgreSQL 用 `$1, $2`，SQLite 用 `?`。`DB.query()` 自动处理。

### 开发流程（SQLite）

通常不需要手动操作数据库。`start.bat` 启动时会自动运行 `npm run migrate`。

如需手动迁移：

```bash
npm run migrate
```

### 添加/修改表结构

1. 编辑 `database/migrations/001-init-sqlite.sql`（开发）或 `001-init-postgres.sql`（生产）
2. 注意两个文件的 SQL 语法差异（参考现有表结构）
3. 运行 `npm run migrate` 测试

---

## 前端开发

```bash
cd frontend
npm run dev
# 前端运行在 http://localhost:5174
# API 请求代理到 http://localhost:3000
```

Vite 使用 `--transpile-only` 模式，忽略 TypeScript 类型错误以加快热更新速度。

---

## 后端开发

```bash
npm run dev
# 后端运行在 http://localhost:3000
```

`ts-node-dev` 监听文件变化自动重启。

---

## 添加新页面

1. 在 `frontend/src/pages/` 下创建组件（使用命名导出 `export function PageName`）
2. 在 `App.tsx` 中添加路由：

```tsx
import { PageName } from './pages/xxx/PageName'

// 在 Routes 中
<Route path="/xxx" element={<PageName />} />
```

3. 如果需要认证保护：

```tsx
<Route
  path="/xxx"
  element={isAuthenticated ? <PageName /> : <Navigate to="/login" />}
 />
```

---

## 添加新 API

1. 在 `src/api/web/` 下创建路由文件
2. 在 `src/app.ts` 中注册路由
3. 前端 `frontend/src/services/` 下添加对应的 service 函数

---

## 常见问题

### Q: 启动报错 "Cannot find module"

依赖未安装。运行 `npm install` 和 `cd frontend && npm install`。

### Q: SQLite 数据库锁定

确保只有一个进程在写入数据库。重启后端服务即可。

### Q: RSA 密钥未找到

运行 `npm run generate-keys` 生成密钥对。

### Q: 前端页面空白

检查浏览器控制台是否有错误。可能是 Vite 代理未正确连接后端（检查 `vite.config.ts` 中的 proxy 配置）。

### Q: 迁移失败

删除 `data/skin_server.db`（如果是 SQLite），然后重新运行 `npm run migrate`。

---

## Git 分支模型

| 分支 | 用途 |
|------|------|
| `main` | Windows 开发主线，SQLite |
| `docker` | Linux + Docker 生产，PostgreSQL |
| `linux-native` | 纯 Linux 生产，PostgreSQL/SQLite |

```bash
# 开发完成后，将 main 的改动 cherry-pick 到 docker 分支
git checkout docker
git cherry-pick main

# 推送到服务器
git push docker
```
