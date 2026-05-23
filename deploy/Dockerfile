FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制源代码
COPY . .

# 生成Prisma Client（如果使用Prisma）
# RUN npx prisma generate

# 编译TypeScript
RUN npm run build

# 创建必要目录
RUN mkdir -p /app/uploads/skins /app/uploads/capes /app/keys /app/logs

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
