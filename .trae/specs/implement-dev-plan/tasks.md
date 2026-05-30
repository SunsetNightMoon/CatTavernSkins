# Tasks

- [ ] Task 1: Cloudflare Turnstile 集成
  - [ ] 1.1 安装 Turnstile 相关依赖（无需额外 SDK，使用 fetch 调用 Cloudflare siteverify API）
  - [ ] 1.2 创建 `src/services/TurnstileService.ts`，实现 token 验证逻辑（调用 Cloudflare siteverify API）
  - [ ] 1.3 修改 `src/services/CaptchaService.ts`，增加 Turnstile 优先逻辑：当 `TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY` 已配置时使用 Turnstile，否则回退到算术验证码
  - [ ] 1.4 修改 `src/api/web/captcha.ts`，新增 Turnstile 验证端点 `POST /api/captcha/verify-turnstile`
  - [ ] 1.5 修改 `src/api/web/auth.ts`，注册/登录流程中根据配置选择 Turnstile 或算术验证码
  - [ ] 1.6 前端：创建 `frontend/src/components/TurnstileWidget/` 组件，支持 Managed 模式（注册/登录页）和 Invisible 模式（其它需要保护的页面）
  - [ ] 1.7 前端：修改 `Login.tsx` 和 `Register.tsx`，集成 Turnstile Managed 模式组件
  - [ ] 1.8 前端：在皮肤上传等敏感操作页面集成 Turnstile Invisible 模式
  - [ ] 1.9 新增环境变量：`TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`
  - [ ] 1.10 更新 Helmet CSP 配置，允许加载 Cloudflare Turnstile 脚本域名

- [ ] Task 2: OAuth 2.0 第三方登录（GitHub / Microsoft）
  - [ ] 2.1 安装 OAuth 相关依赖（`passport`、`passport-github2`、`passport-microsoft`，或使用轻量级手动实现）
  - [ ] 2.2 创建 `src/config/oauth.ts`，读取 OAuth 环境变量配置
  - [ ] 2.3 创建数据库迁移 `002-oauth-accounts.sql`，新增 `oauth_accounts` 表（id, user_id, provider, provider_account_id, access_token, refresh_token, created_at）
  - [ ] 2.4 创建 `src/models/OAuthAccount.ts`，实现 OAuth 账号关联的 CRUD 操作
  - [ ] 2.5 创建 `src/services/OAuthService.ts`，实现 OAuth 授权 URL 生成、回调处理、账号关联/创建逻辑
  - [ ] 2.6 创建 `src/api/web/oauth.ts` 路由，实现 `GET /api/auth/oauth/:provider`（发起授权）和 `GET /api/auth/oauth/:provider/callback`（回调处理）
  - [ ] 2.7 修改 `src/app.ts`，注册 OAuth 路由
  - [ ] 2.8 前端：修改 `Login.tsx` 和 `Register.tsx`，添加 GitHub / Microsoft 登录按钮（根据后端配置动态显示）
  - [ ] 2.9 前端：创建 OAuth 回调页面 `OAuthCallback.tsx`，处理登录成功/失败状态
  - [ ] 2.10 新增环境变量：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`MICROSOFT_CLIENT_ID`、`MICROSOFT_CLIENT_SECRET`、`OAUTH_CALLBACK_BASE_URL`

- [ ] Task 3: S3 / MinIO 对象存储
  - [ ] 3.1 安装 AWS SDK 依赖（`@aws-sdk/client-s3`）
  - [ ] 3.2 创建 `src/config/storage.ts`，读取存储相关环境变量
  - [ ] 3.3 创建 `src/services/StorageService.ts`，定义存储抽象接口（`upload`、`delete`、`getUrl`、`exists`）
  - [ ] 3.4 实现 `LocalStorageProvider`，封装现有本地文件存储逻辑
  - [ ] 3.5 实现 `S3StorageProvider`，使用 AWS SDK 实现 S3 上传/删除/获取 URL
  - [ ] 3.6 修改 `src/api/textures/upload.ts`，使用 `StorageService` 替代直接文件操作
  - [ ] 3.7 修改静态文件服务逻辑（`src/app.ts` 中 `/uploads` 路由），S3 模式下通过代理或重定向访问文件
  - [ ] 3.8 新增环境变量：`STORAGE_TYPE`（`local`/`s3`）、`S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY`、`S3_SECRET_KEY`、`S3_REGION`、`S3_PUBLIC_URL`

- [ ] Task 4: Swagger / OpenAPI 文档
  - [ ] 4.1 安装 Swagger 相关依赖（`swagger-ui-express`、`swagger-jsdoc`）
  - [ ] 4.2 创建 `src/config/swagger.ts`，定义 OpenAPI 基础信息（标题、版本、服务器地址等）
  - [ ] 4.3 为现有 API 路由添加 JSDoc 注释（Yggdrasil API、Web 管理 API），生成 OpenAPI 规范
  - [ ] 4.4 修改 `src/app.ts`，注册 Swagger UI 路由（`/api-docs`）和 JSON 规范路由（`/api-docs.json`）
  - [ ] 4.5 新增环境变量：`ENABLE_SWAGGER`（默认 `false`，开发环境可设为 `true`）
  - [ ] 4.6 更新 Helmet CSP 配置，允许 Swagger UI 加载所需资源

- [ ] Task 5: 单元测试
  - [ ] 5.1 配置 Jest 测试环境（确认 `jest.config.js` 或 `package.json` 中的 jest 配置）
  - [ ] 5.2 创建测试工具：`tests/helpers/testDb.ts`（内存 SQLite 测试数据库）、`tests/helpers/mockRequest.ts`（Express 请求/响应模拟）
  - [ ] 5.3 编写认证逻辑测试：`tests/unit/services/AuthService.test.ts`
  - [ ] 5.4 编写 CaptchaService 测试：`tests/unit/services/CaptchaService.test.ts`
  - [ ] 5.5 编写图片验证测试：`tests/unit/utils/image.test.ts`
  - [ ] 5.6 编写数据库抽象层测试：`tests/unit/config/database.test.ts`
  - [ ] 5.7 编写存储抽象层测试：`tests/unit/services/StorageService.test.ts`
  - [ ] 5.8 编写 OAuth 流程测试：`tests/unit/services/OAuthService.test.ts`
  - [ ] 5.9 编写 API 端点集成测试：`tests/integration/api/auth.test.ts`、`tests/integration/api/skins.test.ts`
  - [ ] 5.10 更新 `package.json` 的 `test` 脚本，确保覆盖率报告生成

# Task Dependencies
- [Task 2] 依赖 [Task 1]（OAuth 登录页面需要集成 Turnstile 验证）
- [Task 3] 独立，可与 Task 1、2 并行开发
- [Task 4] 独立，可与其它 Task 并行开发
- [Task 5] 依赖 [Task 1] [Task 2] [Task 3]（测试需要覆盖新实现的功能模块）
