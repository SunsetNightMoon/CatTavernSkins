# 代码审查标准与流程

> 项目：Minecraft Skin Server (Node.js + TypeScript + React)
> 制定日期：2026-05-19
> 版本：v1.0

---

## 一、代码审查流程

### 1. 提交前自检（开发者）

开发者在提交 PR 前必须完成：

- [ ] 通过 TypeScript 编译（`npx tsc --noEmit`）
- [ ] 通过 ESLint 检查（`npx eslint src/`）
- [ ] 关键路径有单元测试
- [ ] 手动测试了相关功能
- [ ] 敏感信息（密钥、密码）未提交

### 2. PR 创建规范

PR 标题格式：`[类型] 简短描述`

类型：`feat` / `fix` / `refactor` / `perf` / `docs` / `chore`

示例：`[fix] 修复收藏披风在衣柜中不显示的问题`

PR 描述必须包含：
- 改动了哪些文件
- 为什么这样改
- 如何测试
- 是否有破坏性变更

### 3. 审查步骤

| 步骤 | 审查人 | 内容 |
|------|--------|------|
| 1 | 开发者 | 自检，确保编译通过，测试通过 |
| 2 | 同级开发者 | 代码逻辑、可读性、一致性 |
| 3 | 技术负责人 | 架构、安全、性能、破坏性变更 |
| 4 | （可选）安全负责人 | 涉及认证、权限、SQL 的改动 |

### 4. 审查意见分级

| 级别 | 标记 | 含义 | 必须解决才能合并？ |
|------|------|------|----------------------|
| 🔴 阻塞 | `blocker` | 安全漏洞、数据损坏、破坏性功能 | ✅ 是 |
| 🟡 建议 | `suggestion` | 代码质量、可维护性 | ❌ 否（讨论后决定）|
| 💭 轻量 | `nit` | 命名、注释、格式 | ❌ 否 |

---

## 二、后端代码审查清单

### 🔴 阻塞项（必须修复）

#### 安全性
- [ ] **SQL 注入**：所有 SQL 必须使用参数化查询（`$1, $2`），禁止字符串拼接
  ```typescript
  // ❌ 错误
  DB.query(`SELECT * FROM users WHERE id = '${id}'`)
  // ✅ 正确
  DB.query('SELECT * FROM users WHERE id = $1', [id])
  ```
- [ ] **认证检查**：所有需要登录的接口必须走 `requireAuth` 中间件，禁止手动解析 header
- [ ] **权限检查**：修改/删除操作必须验证资源归属（`user_id === token.user_id`）
- [ ] **输入验证**：所有 `req.body` / `req.query` / `req.params` 必须验证类型和范围
- [ ] **文件上传**：限制文件类型（白名单）、大小、保存路径（禁止路径穿越）
- [ ] **错误信息**：禁止把内部错误详情（SQL 错误、堆栈）返回给客户端
- [ ] **Token 处理**：禁止在前端明文存储敏感 token，使用 httpOnly cookie 或安全存储

#### 数据完整性
- [ ] **事务处理**：多步写操作必须使用事务（`BEGIN / COMMIT / ROLLBACK`）
- [ ] **并发安全**：计数器更新（`download_count++`）需防止竞态条件
- [ ] **外键约束**：数据库层面设置外键，避免孤儿记录

#### 错误处理
- [ ] **统一错误格式**：所有错误响应使用 `{ error, errorMessage }` 格式
- [ ] **HTTP 状态码正确**：400/401/403/404/500 使用恰当
- [ ] **错误被捕获**：`async/await` 必须有 `try/catch`，或统一错误处理中间件

---

### 🟡 建议项（应该修复）

#### 代码组织
- [ ] **业务逻辑不写在路由层**：路由只做参数解析 + 调用 service，业务逻辑在 `services/` 中
- [ ] **Model 只做数据访问**：不写业务逻辑，返回 Promise\<Model>
- [ ] **魔法数字提取为常量**：文件大小限制、分页大小等定义在上层
  ```typescript
  // ❌ 散落在代码中
  if (file.size > 2 * 1024 * 1024)
  // ✅ 提取为常量
  const MAX_SKIN_SIZE = 2 * 1024 * 1024
  ```
- [ ] **枚举值用 const enum 或 union type**，不用裸字符串
  ```typescript
  // ❌
  if (user.level >= 1) ...
  // ✅
  const enum UserLevel { User = 0, Admin = 1, SuperAdmin = 2 }
  if (user.level >= UserLevel.Admin) ...
  ```

#### 可维护性
- [ ] **函数不超过 50 行**，单个文件不超过 300 行
- [ ] **重复代码提取为函数**（DRY 原则）
- [ ] **异步函数命名**：不需要加 `Async` 后缀（TypeScript 类型已区分）
- [ ] **日志规范**：使用 `console.error` 记录错误，`console.log` 记录关键业务操作，禁止提交 `console.log` 调试语句

---

### 💭 轻量项（可选）

- [ ] 注释解释"为什么"而不是"是什么"
- [ ] 变量/函数命名自解释（不需要注释就能读懂）
- [ ] 删除死代码（不会执行到的分支）
- [ ] 使用 `const` 优先，少用 `let`

---

## 三、前端代码审查清单

### 🔴 阻塞项（必须修复）

#### 安全性
- [ ] **认证 token 获取**：统一从 Zustand store 获取，禁止 `localStorage.getItem('token')`
- [ ] **XSS 防护**：用户生成内容（皮肤名、描述）渲染时用 `{variable}` 而非 `dangerouslySetInnerHTML`
- [ ] **权限控制**：前端隐藏 UI 元素不等于后端权限检查，后端必须独立验证

#### 状态管理
- [ ] **Zustand store 为认证状态唯一来源**，`localStorage` 只用于持久化
- [ ] **条件渲染用三元运算符**，不用 `&&`（避免 `0` 被渲染）
  ```tsx
  // ❌ 错误：当 count=0 时会渲染 0
  {count && <span>{count}</span>}
  // ✅ 正确
  {count ? <span>{count}</span> : null}
  ```

#### 错误处理
- [ ] **API 调用必须有错误处理**，`fetch` 必须 `.catch()` 或 `try/catch`
- [ ] **用户友好错误提示**：用 `message.error()` 显示后端返回的 `errorMessage`
- [ ] **无限循环检查**：`useEffect` 依赖数组不包含对象引用（用基本类型）

---

### 🟡 建议项（应该修复）

#### TypeScript
- [ ] **禁用 `any`**，用具体类型或 `unknown`
- [ ] **Props 接口定义**：组件 Props 必须有 interface，命名 `XxxProps`
- [ ] **API 响应类型**：定义 `ApiResponse<T>` 类型，不用 `any`

#### React 最佳实践
- [ ] **组件拆分**：单个组件不超过 200 行，复杂 UI 拆为子组件
- [ ] **自定义 Hook 提取逻辑**：数据获取、事件处理抽为 `useXxx()` Hook
- [ ] **`useMemo` / `useCallback`** 用于昂贵计算或稳定引用，不滥用
- [ ] **Key 用稳定 ID**，不用数组索引（列表顺序变化时会产生 bug）

#### 样式
- [ ] **避免行内样式**，用 CSS Modules 或 styled-components
- [ ] **响应式设计**：用 `useViewportSize` 或 antd `Row/Col` 的 `xs/sm/md/lg` 断点

---

### 💭 轻量项（可选）

- [ ] 删除 `console.log` 调试语句
- [ ] 组件导出用 `export function` 而非 `export default`
- [ ] 导入顺序：第三方 → 绝对路径 → 相对路径，组内按字母排序

---

## 四、常见反模式（本项目已出现）

### 1. 认证检查不一致

```typescript
// ❌ 错误：在路由内手动解析 header
const authHeader = req.headers.authorization
if (!authHeader) ...

// ✅ 正确：使用中间件
router.get('/', requireAuth, requireAdmin, (req, res) => {...})
```

### 2. 前端 token 获取方式不统一

```typescript
// ❌ 错误：直接从 localStorage 读取
const token = localStorage.getItem('token')

// ✅ 正确：从 Zustand store 读取
const { token } = useAuthStore()
```

### 3. 业务逻辑写在路由层

```typescript
// ❌ 错误：路由里写业务逻辑
router.post('/upload', (req, res) => {
  // 50 行业务逻辑...
})

// ✅ 正确：路由 → service → model
router.post('/upload', async (req, res) => {
  const result = await SkinService.upload(req.file, req.body)
  res.json(result)
})
```

### 4. Three.js 类型冲突的临时方案

```typescript
// ❌ 当前临时方案（已有）
const _3: any = THREE

// ✅ 长期方案：在 tsconfig.json 中配置 paths 强制单一 three 实例
// 或使用 `npm dedupe` / `pnpm` 避免重复依赖
```

---

## 五、自动化工具建议

### 必须配置

| 工具 | 用途 | 配置文件 |
|------|------|----------|
| TypeScript Strict Mode | 类型安全 | `tsconfig.json` `"strict": true` |
| ESLint + @typescript-eslint | 代码质量 | `.eslintrc.json` |
| Prettier | 格式统一 | `.prettierrc` |
| Husky + lint-staged | 提交前检查 | `.husky/pre-commit` |
| Jest + Testing Library | 单元测试 | `jest.config.js` |

### 推荐 ESLint 规则（`.eslintrc.json`）

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

---

## 六、审查者职责

- 审查者必须在 24 小时内给出首次反馈
- 审查意见必须具体（指出哪行、为什么、建议怎么改）
- 审查者有权拒绝合并，但必须解释原因
- 被拒绝的 PR 修改后，原审查者必须重新审查

---

## 七、紧急情况流程

 hotfix 可以跳过同级审查，但必须：
1. 技术负责人审查
2. 事后补充代码审查记录
3. 下一个正常 PR 中附上单元测试

---

*本文档存放在 `docs/CODE_REVIEW.md`，随项目演进持续更新。*
