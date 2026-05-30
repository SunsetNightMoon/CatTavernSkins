# Checklist

## Cloudflare Turnstile 集成
- [ ] TurnstileService 可正确验证 Turnstile token（调用 Cloudflare siteverify API）
- [ ] 当 TURNSTILE_SITE_KEY 和 TURNSTILE_SECRET_KEY 已配置时，注册/登录使用 Turnstile 验证
- [ ] 当 Turnstile 未配置时，回退到本地算术验证码，功能不中断
- [ ] ENABLE_CAPTCHA=false 时跳过所有人机验证
- [ ] 前端注册/登录页集成 Turnstile Managed 模式组件
- [ ] 前端其它敏感操作页面集成 Turnstile Invisible 模式
- [ ] Helmet CSP 配置允许加载 Cloudflare Turnstile 脚本域名

## OAuth 2.0 第三方登录
- [ ] GitHub OAuth 登录流程完整可用（授权 → 回调 → 创建/关联用户 → 登录）
- [ ] Microsoft OAuth 登录流程完整可用
- [ ] 首次 OAuth 登录自动创建本地用户账号
- [ ] OAuth 邮箱与已有用户匹配时自动关联
- [ ] OAuth 未配置时隐藏对应登录按钮
- [ ] oauth_accounts 数据库表已创建并正确关联 users 表
- [ ] 前端 OAuth 回调页面正确处理成功/失败状态

## S3 / MinIO 对象存储
- [ ] StorageService 抽象接口定义完整（upload、delete、getUrl、exists）
- [ ] LocalStorageProvider 封装现有本地文件存储逻辑，行为不变
- [ ] S3StorageProvider 可正确上传/删除/获取 S3 对象
- [ ] STORAGE_TYPE=s3 时文件上传到 S3，数据库 file_path 存储 S3 key
- [ ] STORAGE_TYPE=local 或未配置时使用本地存储（默认行为）
- [ ] 上传路由使用 StorageService 替代直接文件操作
- [ ] S3 模式下静态文件访问通过代理或重定向正常工作

## Swagger / OpenAPI 文档
- [ ] /api-docs 路径可访问 Swagger UI 界面
- [ ] /api-docs.json 返回 OpenAPI 3.0 格式的 JSON 规范
- [ ] Yggdrasil API 端点在文档中完整描述
- [ ] Web 管理 API 端点在文档中完整描述
- [ ] ENABLE_SWAGGER=false 或未设置时不暴露文档端点
- [ ] Helmet CSP 配置允许 Swagger UI 加载所需资源

## 单元测试
- [ ] npm test 可正常运行所有测试
- [ ] 认证逻辑测试覆盖（注册、登录、令牌验证）
- [ ] CaptchaService 测试覆盖（验证码生成与验证）
- [ ] 图片验证测试覆盖（格式、尺寸、哈希去重）
- [ ] 数据库抽象层测试覆盖（SQLite/PostgreSQL 切换）
- [ ] 存储抽象层测试覆盖（本地/S3 读写）
- [ ] OAuth 流程测试覆盖（GitHub/Microsoft 回调处理）
- [ ] API 端点集成测试覆盖（auth、skins）
