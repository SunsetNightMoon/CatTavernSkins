# ============================================
# Minecraft Skin Server - 一体化镜像（后端 API + 前端静态资源）
# 多阶段构建：
#   - backend-builder：安装全量依赖并编译后端 TS（dist/）
#   - frontend-builder：构建前端静态资源（frontend/dist/）
#   - runtime：仅保留生产依赖 + 后端产物 + 前端产物，镜像更小
# 生产环境下后端（NODE_ENV=production）直接提供 frontend/dist 并处理 SPA 回退，
# 因此前端必须打包进本镜像。若改为前端独立托管（如 EdgeOne Pages），
# 见 deploy/README.md 的“前端独立托管”一节。
# ============================================

# ---------- 1. 后端构建阶段 ----------
FROM node:20-alpine AS backend-builder

WORKDIR /app

# 原生模块（bcrypt / sharp / sqlite3）需要编译工具链；
# 仅安装在 builder 阶段，runtime 阶段不含，最终镜像保持精简。
RUN apk add --no-cache python3 make g++

# 先装依赖（含 devDependencies，编译 TS 需要 typescript 等）
COPY package*.json ./
RUN npm install

# 复制源码并编译后端
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 裁剪出仅生产依赖，供 runtime 阶段复制
RUN npm prune --production

# ---------- 2. 前端构建阶段 ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 前端依赖
COPY frontend/package*.json ./
RUN npm install

# 复制前端源码并构建（产物在 /app/frontend/dist）
COPY frontend ./
RUN npm run build

# ---------- 3. 运行阶段 ----------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# 生产依赖 + 后端编译产物 + 迁移文件 + package.json
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY package*.json ./
COPY database ./database

# 前端静态产物（后端在生产模式下从 frontend/dist 提供）
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 运行期目录（卷挂载点）
RUN mkdir -p /app/uploads/skins /app/uploads/capes /app/keys /app/logs

EXPOSE 3000

CMD ["npm", "start"]
