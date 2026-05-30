# 开发计划实施 Spec

## Why
README.md 中的开发计划列出了 5 项待实现功能（Cloudflare 防护、OAuth 2.0、S3 存储、Swagger 文档、单元测试），这些功能将显著提升系统的安全性、可用性、可扩展性和可维护性。

## What Changes
- 集成 Cloudflare Turnstile 验证，替换现有的本地算术验证码
- 新增 OAuth 2.0 第三方登录（GitHub / Microsoft）
- 新增 S3 / MinIO 对象存储后端，替代本地文件存储
- 集成 Swagger / OpenAPI 自动生成 API 文档
- 建立单元测试体系，覆盖核心模块

## Impact
- Affected specs: 认证系统、文件上传/存储、API 文档、测试覆盖
- Affected code:
  - `src/services/CaptchaService.ts` — 替换为 Turnstile 验证
  - `src/api/web/captcha.ts` — 替换为 Turnstile 路由
  - `src/api/web/auth.ts` — 新增 OAuth 登录端点
  - `src/api/textures/upload.ts` — 存储后端抽象化
  - `src/app.ts` — 新增 Swagger 路由、OAuth 路由
  - `src/config/` — 新增 S3 配置、OAuth 配置
  - `src/models/User.ts` — 新增 OAuth 关联字段
  - `frontend/src/pages/Auth/` — 新增 OAuth 登录 UI、Turnstile 组件
  - `database/migrations/` — 新增 OAuth 字段迁移

---

## ADDED Requirements

### Requirement: Cloudflare Turnstile 集成
系统 SHALL 集成 Cloudflare Turnstile 作为人机验证方案，替换现有的本地算术验证码。

#### Scenario: 注册/登录场景使用 Managed 模式
- **WHEN** 用户访问注册或登录页面
- **THEN** 系统 SHALL 渲染 Turnstile Managed 模式组件，由 Cloudflare 根据风险自动决定是否弹出质询
- **AND** 后端 SHALL 验证 Turnstile token 有效性后才能继续注册/登录流程

#### Scenario: 其它页面使用 Invisible 模式
- **WHEN** 用户访问非认证类页面（如皮肤上传、个人资料编辑等需要保护的操作）
- **THEN** 系统 SHALL 使用 Turnstile Invisible 模式，无感运行，异常行为时触发 JS 质询

#### Scenario: Turnstile 未配置时回退
- **WHEN** 环境变量 `TURNSTILE_SITE_KEY` 或 `TURNSTILE_SECRET_KEY` 未设置
- **THEN** 系统 SHALL 回退到现有的本地算术验证码，确保功能不中断

#### Scenario: 验证码开关
- **WHEN** 环境变量 `ENABLE_CAPTCHA` 设为 `false`
- **THEN** 系统 SHALL 跳过所有人机验证步骤

---

### Requirement: OAuth 2.0 第三方登录
系统 SHALL 支持 GitHub 和 Microsoft OAuth 2.0 第三方登录。

#### Scenario: GitHub OAuth 登录
- **WHEN** 用户点击 "GitHub 登录" 按钮
- **THEN** 系统 SHALL 重定向到 GitHub OAuth 授权页面
- **AND** 授权回调后，系统 SHALL 创建或关联用户账号并登录

#### Scenario: Microsoft OAuth 登录
- **WHEN** 用户点击 "Microsoft 登录" 按钮
- **THEN** 系统 SHALL 重定向到 Microsoft OAuth 授权页面
- **AND** 授权回调后，系统 SHALL 创建或关联用户账号并登录

#### Scenario: 首次 OAuth 登录创建账号
- **WHEN** 用户首次通过 OAuth 登录且该 OAuth 账号未关联任何本地用户
- **THEN** 系统 SHALL 自动创建本地用户账号（邮箱取自 OAuth 信息）
- **AND** 系统 SHALL 要求用户设置 profile_name（如果 OAuth 信息中无可用用户名）

#### Scenario: OAuth 账号关联已有用户
- **WHEN** 用户通过 OAuth 登录，且 OAuth 邮箱与已有用户邮箱匹配
- **THEN** 系统 SHALL 自动关联 OAuth 账号到已有用户并登录

#### Scenario: OAuth 配置缺失
- **WHEN** OAuth 相关环境变量（如 `GITHUB_CLIENT_ID`）未配置
- **THEN** 系统 SHALL 隐藏对应的 OAuth 登录按钮，不影响其他登录方式

---

### Requirement: S3 / MinIO 对象存储
系统 SHALL 支持 S3 兼容的对象存储后端（AWS S3 / MinIO），作为本地文件存储的替代方案。

#### Scenario: 上传皮肤/披风到 S3
- **WHEN** 系统配置 `STORAGE_TYPE=s3` 且用户上传皮肤/披风
- **THEN** 系统 SHALL 将文件上传到 S3 存储桶，而非本地文件系统
- **AND** 数据库中的 `file_path` 字段 SHALL 存储 S3 对象的 URL 或 key

#### Scenario: 本地存储回退
- **WHEN** 系统配置 `STORAGE_TYPE=local` 或未配置 S3
- **THEN** 系统 SHALL 使用现有的本地文件存储方式（默认行为）

#### Scenario: S3 配置
- **WHEN** 管理员配置 S3 相关环境变量（`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`）
- **THEN** 系统 SHALL 使用这些配置连接 S3 兼容存储服务

#### Scenario: 存储抽象层
- **WHEN** 任何模块需要读写文件
- **THEN** 系统 SHALL 通过统一的存储抽象接口操作，不直接依赖文件系统或 S3 SDK

---

### Requirement: Swagger / OpenAPI 文档
系统 SHALL 自动生成并暴露 Swagger / OpenAPI 格式的 API 文档。

#### Scenario: 访问 API 文档
- **WHEN** 用户访问 `/api-docs` 路径
- **THEN** 系统 SHALL 展示 Swagger UI 界面，列出所有 API 端点及其参数、响应格式

#### Scenario: OpenAPI JSON 规范
- **WHEN** 用户访问 `/api-docs.json` 路径
- **THEN** 系统 SHALL 返回 OpenAPI 3.0 格式的 JSON 规范文件

#### Scenario: 生产环境可选
- **WHEN** 环境变量 `ENABLE_SWAGGER` 设为 `false` 或未设置（生产环境默认关闭）
- **THEN** 系统 SHALL 不暴露 API 文档端点

---

### Requirement: 单元测试
系统 SHALL 建立单元测试体系，覆盖核心业务逻辑。

#### Scenario: 运行测试
- **WHEN** 开发者执行 `npm test`
- **THEN** 系统 SHALL 运行所有单元测试并输出结果

#### Scenario: 测试覆盖范围
- **WHEN** 测试套件运行完成
- **THEN** 以下核心模块 SHALL 有测试覆盖：
  - 认证逻辑（注册、登录、令牌验证）
  - CaptchaService（验证码生成与验证）
  - 图片验证（格式、尺寸、哈希去重）
  - 数据库抽象层（DB.query 的 SQLite/PostgreSQL 切换）
  - 存储抽象层（本地/S3 读写）
  - OAuth 流程（GitHub/Microsoft 回调处理）

#### Scenario: CI 集成
- **WHEN** 代码提交到仓库
- **THEN** CI 流水线 SHALL 自动运行 `npm test` 并在测试失败时阻止合并

---

## MODIFIED Requirements

### Requirement: 人机验证
现有本地算术验证码（`CaptchaService`）SHALL 保留作为 Turnstile 未配置时的回退方案。当 `TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY` 已配置时，SHALL 优先使用 Turnstile 验证。

### Requirement: 文件上传
现有文件上传逻辑（`src/api/textures/upload.ts`）SHALL 通过存储抽象层操作文件，而非直接使用 `multer.diskStorage`。`multer` 的 `storage` 配置 SHALL 根据存储类型动态选择本地磁盘或内存（S3 上传时使用内存临时存储）。

### Requirement: 用户注册/登录
注册和登录 API SHALL 支持额外的验证方式：
- Turnstile token 验证（替代或补充现有验证码）
- OAuth 回调端点（`/api/auth/oauth/:provider/callback`）

---

## REMOVED Requirements

（无移除的需求，现有功能均保留或升级）
