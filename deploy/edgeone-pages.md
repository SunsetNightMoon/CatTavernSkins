# 部署到 EdgeOne Pages（前后端分离 / 跨站部署）

本文档说明如何把**前端**托管到 [腾讯 EdgeOne Pages](https://edgeone.ai/products/pages)（静态托管），
**后端**单独部署（VPS / 容器 / 任意 Node 主机），二者使用不同域名。

> ⚠️ 这是一种**可选**的新增部署方式。它**不影响**现有的两种同源部署：
> - **Windows 一键启动**（`start.bat` / `npm run dev`，前端 Vite 代理到后端）
> - **Docker 同源部署**（`deploy/docker-compose.yml`，前后端同域名）
>
> 不配置本文涉及的任何环境变量时，项目行为与之前完全一致。

---

## 架构对比

| | 同源部署（默认） | 跨站部署（EdgeOne） |
|---|---|---|
| 前端 | 与后端同域名，相对路径 `/api` | EdgeOne Pages 独立域名 |
| 后端 | 提供 API + 静态前端 | 仅 API，独立域名 |
| 鉴权 Cookie | `SameSite=Lax` | `SameSite=None; Secure`（需 HTTPS） |
| CORS | 同源，无需配置 | 需要白名单 |
| 图片/纹理 | 后端 `/uploads` | 建议走 S3/CDN 绝对地址 |

---

## 一、后端配置

在后端 `.env` 中新增（示例域名请替换为你的实际域名）：

```bash
NODE_ENV=production
BASE_URL=https://api.example.com            # 后端自身域名

# 允许的前端来源（逗号分隔，可多个：自定义域名 + EdgeOne 预览域名）
CORS_ORIGINS=https://skins.example.com,https://skins.example.pages.dev

# 跨站 Cookie：浏览器要求跨站携带 Cookie 必须 None + Secure（强制 HTTPS）
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

要点：
- 后端**必须** HTTPS（`Secure` Cookie 在非 HTTPS 下浏览器不收）。
- 后端在反向代理（Nginx/Caddy）之后时，确保转发 `X-Forwarded-Proto`（代码已 `app.set('trust proxy', 1)`）。
- `CORS_ORIGINS` 未命中的来源不会收到 CORS 头，浏览器会拦截——这是预期的安全行为。
- **强烈建议**配合 S3/对象存储（`STORAGE_TYPE=s3` + `S3_PUBLIC_URL`），让皮肤/披风图片走 CDN 绝对地址，
  避免跨站访问后端 `/uploads` 的额外配置。

### CSRF 权衡说明

`SameSite=None` 会放开跨站请求携带 Cookie，理论上增加 CSRF 面。本项目的缓解措施：
- 登录/注册/上传均有**人机验证**（算术或 Turnstile）；
- 鉴权 Cookie 为 `httpOnly`，JS 无法读取；
- 写操作集中在带校验的 API，且 CORS 白名单限制了可发起带凭据请求的来源。

如需更强保护，可在后端补充 CSRF Token 或校验 `Origin` 头（后续可选增强）。

---

## 二、前端配置

前端通过**构建时**环境变量 `VITE_API_BASE` 指向后端绝对地址。

在 EdgeOne Pages 项目的「环境变量」中设置：

```bash
VITE_API_BASE=https://api.example.com
```

- 留空或不设置 → 前端继续使用相对路径 `/api`（同源行为，本地开发/Docker 不受影响）。
- 设置后，前端的 axios 与原生 `fetch('/api/...')`、`/uploads/...` 会自动改写为
  `https://api.example.com/...`，并以 `credentials: 'include'` 携带跨站 Cookie。
  （实现见 `frontend/src/utils/apiBase.ts`，入口 `main.tsx` 调用 `installApiBase()`。）

### EdgeOne Pages 构建设置

| 项 | 值 |
|---|---|
| 根目录 / Root | `frontend` |
| 构建命令 / Build command | `npm run build` |
| 输出目录 / Output | `frontend/dist` |
| 环境变量 | `VITE_API_BASE=https://api.example.com` |

SPA 路由回退：EdgeOne Pages 需配置将未命中静态资源的请求回退到 `index.html`
（History 路由模式所需）。

---

## 三、验证清单

1. 后端 `https://api.example.com/api/settings/public` 直接可访问（返回 JSON）。
2. 前端域名打开站点，登录后刷新仍保持登录态（确认跨站 Cookie 生效）。
3. 浏览器 DevTools → Network：API 请求指向后端域名，响应含
   `Access-Control-Allow-Origin: <你的前端域名>` 与 `Access-Control-Allow-Credentials: true`。
4. Application → Cookies：`auth_token` 具有 `SameSite=None` 且 `Secure`。
5. 皮肤/披风图片正常显示（若用 S3/CDN，确认 `S3_PUBLIC_URL` 已配置）。

---

## 回到同源部署

删除（或留空）后端的 `CORS_ORIGINS`、`COOKIE_SAMESITE`、`COOKIE_SECURE` 和前端的
`VITE_API_BASE`，重新构建/重启即可恢复同源行为。无需改动任何代码。
