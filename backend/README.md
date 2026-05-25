# Ops Dashboard 后端

基于 **NestJS 11 + Prisma 6 + SQLite** 的后端服务，承担鉴权、用户与资源管理、SSH 终端代理、健康检查、邮件、备份等模块。

> 当前目录的所有路径均相对于 `backend/`。

## 目录结构（关键节点）

```
backend/
├── prisma/
│   ├── schema.prisma                  # 数据模型定义（AdminUser/Resource/AuditLog 等）
│   ├── migrations/                    # SQLite 迁移脚本（Prisma 生成 + 手写 RedefineTable）
│   └── seed.ts                        # 首启种子（创建初始管理员）
├── src/
│   ├── auth/                          # 鉴权、改密、ForceChangePasswordGuard 等
│   ├── users/                         # 用户增删改查
│   ├── audit/                         # AuditService：写审计日志
│   ├── prisma/                        # PrismaService 全局注入
│   ├── crypto/                        # 对称加密（用于 MFA secret 等）
│   └── ...                            # health-check、mail、mfa、resources、ssh 等业务模块
└── package.json
```

## 运行脚本

| 命令 | 说明 |
| --- | --- |
| `npm run start:dev` | 监听模式启动（`nest start --watch`），开发首选 |
| `npm run start` | 一次性启动 |
| `npm run start:prod` | 启动 `dist/` 中的产物，生产部署使用 |
| `npm run build` | `nest build` 产出 `dist/` |
| `npm run prisma:generate` | 生成 Prisma Client 类型 |
| `npm run prisma:migrate` | `prisma migrate deploy`，部署时应用迁移 |
| `npm run prisma:migrate:dev` | `prisma migrate dev`，开发时新增迁移 |
| `npm run seed` | 执行 `prisma/seed.ts`，写入初始管理员 |

## 首次登录强制修改密码

当管理员创建新用户、或重置某用户的密码时，该用户应当在下次登录后被强制修改密码后才能访问业务接口。后端通过 `AdminUser` 上的两个字段 + 一个全局守卫 + 一个改密接口共同实现这一约束。

### `AdminUser` 字段语义

| 字段 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `mustChangePassword` | `Boolean` | `true`（schema 默认） | 当前用户是否处于「强制改密」状态。`true` 表示在调用 `POST /api/auth/change-password` 完成改密之前，所有非白名单受保护接口都会被 `ForceChangePasswordGuard` 以 HTTP 403 拒绝。 |
| `passwordChangedAt` | `DateTime?` | `NULL` | 最近一次成功改密的服务器时间。仅用于审计与可观测，不参与登录判定。初次建账尚未改密时为 `NULL`。 |

> Schema 默认值为 `true` 是为了让 `UsersService.create` 创建的新用户自动落入强制改密流。存量用户由迁移显式回填为 `false`，初始管理员由 `seed.ts` 显式置为 `false`，自助注册用户在 `auth.controller.ts#register` 中显式置为 `false`，三者都覆盖 schema 默认。

### 字段流转规则

| 场景 | `mustChangePassword` | `passwordChangedAt` |
| --- | --- | --- |
| 迁移 `add_must_change_password` 应用到存量用户 | `false`（覆盖 schema 默认） | `NULL` |
| `seed.ts` 创建初始管理员（不存在时） | `false` | `NULL` |
| `seed.ts` 发现已存在管理员 | 不修改 | 不修改 |
| `POST /api/auth/register`（自助注册） | `false` | `NULL` |
| `UsersService.create`（管理员新建用户） | `true` | `NULL` |
| `UsersService.update` 携带 `password`（管理员重置密码） | `true` | 不修改 |
| `UsersService.update` 不携带 `password`（更新邮箱/角色等） | 不修改 | 不修改 |
| `AuthService.changePassword` 成功 | `false` | `new Date()` |

> 错误与未授权分支均不修改 `mustChangePassword` 与 `passwordChangedAt`。错误响应也不会回显 `oldPassword` / `newPassword` 明文。

### `ForceChangePasswordGuard`

定义于 `src/auth/force-change-password.guard.ts`，在 `AuthModule` 中通过 `APP_GUARD` 全局注册。

执行规则：

1. 若请求未携带有效 JWT（`req.user` 不存在），守卫直接放行，由其他鉴权守卫处理；
2. 若请求 `method + path` 命中白名单，无条件放行；
3. 否则查 DB 取 `AdminUser.mustChangePassword`：
   - `false` —— 放行；
   - `true` —— 写入一条 `auth.force_change_blocked` 审计后，抛 `ForbiddenException`，响应：

```json
{
  "code": "MUST_CHANGE_PASSWORD",
  "message": "请先修改初始密码"
}
```

HTTP 状态码为 `403`。`path` 取自 `req.originalUrl.split('?')[0]`，因此 query string 不会影响白名单匹配。

#### 白名单（method + path 精确匹配）

| Method | Path | 用途 |
| --- | --- | --- |
| `GET`  | `/api/auth/me` | 查询当前用户信息（含 `mustChangePassword` 字段） |
| `GET`  | `/api/auth/me/permissions` | 查询当前用户权限 |
| `POST` | `/api/auth/change-password` | 提交改密请求（避免自我拦截） |
| `POST` | `/api/auth/logout` | 登出 |

> 白名单仅精确匹配上述四条 method+path，避免因前缀匹配带来的绕过风险。公开路由（如 `POST /api/auth/login`、`POST /api/auth/register`、`/api/health/status`）因为无 JWT 而在第 1 步即被放行。

### `POST /api/auth/change-password`

实现位于 `src/auth/auth.controller.ts` + `src/auth/auth.service.ts`，仅在挂载 `JwtAuthGuard` 的前提下提供。

#### 请求

```http
POST /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "oldPassword": "string",   // 必填，1..200 字符
  "newPassword": "string"    // 必填，1..200 字符
}
```

#### 成功响应

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "success": true }
```

成功路径会原子完成：

- `bcrypt.hash(newPassword, 12)` → 写入 `password`；
- `mustChangePassword = false`；
- `passwordChangedAt = new Date()`；
- 写一条 `user.change_password` 审计（`detail` 字段为空字符串，不含密码相关数据）。

#### 错误响应（中文文案）

| HTTP | 触发条件 | `message` |
| --- | --- | --- |
| `401` | 未携带或携带非法 JWT（由 `JwtAuthGuard` 拒绝） | NestJS 默认未授权响应 |
| `400` | `oldPassword` 与库中哈希不匹配 | `原密码错误` |
| `400` | `newPassword === oldPassword` | `新密码不能与原密码相同` |
| `400` | `newPassword.length < 8` | `新密码长度不能少于 8 位` |
| `400` | `newPassword` 不同时包含字母与数字 | `新密码必须同时包含字母与数字` |

> 任何错误响应都不回显 `oldPassword` / `newPassword`，也不携带密码哈希。前端可直接将 `error.response.data.message` 透传给用户。

#### 强度策略

`AuthService.assertPasswordStrength` 与前端 `ForceChangePassword.tsx` 保持一致：

- 长度 `>= 8`；
- 同时包含至少一个字母（`/[A-Za-z]/`）与至少一个数字（`/\d/`）。

### 审计动作

所有强制改密相关动作均通过 `AuditService.log(userId, action, targetId?, detail?, ip?)` 记录到 `AuditLog` 表。`detail` 字段不写任何密码相关数据。

| Action | 触发位置 | `userId` | `targetId` | `detail` | 说明 |
| --- | --- | --- | --- | --- | --- |
| `user.change_password` | `AuthService.changePassword` 成功路径 | 当前登录用户 | 当前登录用户 | `""` | 用户主动修改自己的密码 |
| `user.reset_password` | `UsersController.update` 在 `dto.password` 非空时 | 操作管理员 | 被重置用户 ID | `""` | 管理员重置某用户的密码（与既有 `user.update` 区分） |
| `auth.force_change_blocked` | `ForceChangePasswordGuard.canActivate` 拒绝路径 | 被拦截用户 | `undefined` | 被拦截路径（不含 query） | 用户携带 token 访问非白名单路径但仍处于强制改密状态 |

> 当 `dto.password` 为空时，`UsersController.update` 仍记录原有 `user.update` 审计；只有携带 `password` 才转为 `user.reset_password`。

## 登录与会话相关字段

`POST /api/auth/login` 成功响应中 `user` 对象会带上 `mustChangePassword` 字段，前端据此决定是否跳转到强制改密页：

```json
{
  "access_token": "<jwt>",
  "user": {
    "id": "...",
    "username": "...",
    "role": "admin",
    "email": "...",
    "mfaEnabled": false,
    "mustChangePassword": false
  }
}
```

`mfaRequired` 分支与登录失败分支均**不**携带 `mustChangePassword`，避免在 MFA 阶段暴露密码状态。

## 邮件激活账号

用户注册或由管理员创建（未设置密码）后，需通过激活邮件完成账号激活方可登录。

### `AdminUser` 激活相关字段

| 字段 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `activated` | `Boolean` | `false` | 账号是否已激活。`false` 时 `AuthService.login` 拒绝登录并返回 `401 账号尚未激活` |
| `activationToken` | `String` | `""` | 一次性激活令牌（32 字节 hex）。激活完成后清空 |

> 迁移 `add_activation_fields` 将所有存量用户的 `activated` 回填为 `true`，不影响已有账号。

### 激活流程

1. **管理员创建用户**（密码可选）→ 用户 `activated=false`；管理员通过 `POST /api/users/:id/send-activation` 发送激活邮件
2. **用户自助注册**（非首个用户）→ `activated=false`，自动发送激活邮件（需 SMTP 配置且提供邮箱）
3. **首个注册用户（管理员）**→ `activated=true`，直接登录
4. 用户点击邮件中的激活链接 → 前端 `/activate?token=xxx`
5. 前端调用 `GET /api/auth/activate-check?token=xxx` 验证令牌
6. 用户设置密码后调用 `POST /api/auth/activate` → 设置密码、`activated=true`、`activationToken=''`、`mustSetupMfa=true`

### API

| Method | Path | Auth | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/users/:id/send-activation` | 管理员 | 生成/重置 activationToken 并发送激活邮件 |
| `GET` | `/api/auth/activate-check?token=xxx` | 公开 | 验证令牌有效性，返回 `{ valid, username }` |
| `POST` | `/api/auth/activate` | 公开 | Body: `{ token, password }`，设置密码并激活 |

### 激活相关审计动作

| Action | 说明 |
| --- | --- |
| `user.send_activation` | 管理员发送/重发激活邮件 |

`GET /api/auth/me` 返回同一字段，便于前端在刷新页面后通过 `/auth/me` 恢复会话时识别强制改密状态。

## 升级注意事项

- 升级到包含本特性的版本时执行 `npm run prisma:migrate` 应用 `add_must_change_password` 迁移；
- 迁移会将所有存量用户的 `mustChangePassword` 显式置为 `false`，老用户不会被强制改密；
- 初始管理员（`seed.ts`）与自助注册路径（`/api/auth/register`）同样置 `false`，避免容器首启即陷入「无人能登录改密」的循环。
