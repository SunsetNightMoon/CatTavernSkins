import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3000';
// 在 Docker 挂载卷上，宿主机文件改动的 inotify 事件不会穿透到容器，
// 导致 Vite HMR 检测不到改动。开启文件轮询可解决（由 CHOKIDAR_USEPOLLING 控制，
// 容器环境默认开启；本地原生开发可不设，保持高效的原生文件监听）。
const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})

