# Ops Dashboard 后端

基于 **NestJS 11 + Prisma 6 + SQLite** 的后端服务，承担鉴权（本地密码 / MFA / OIDC 单点登录）、用户与资源管理、SSH 终端代理、健康检查、邮件、备份等模块。

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
│   ├── oidc/                          # OIDC 单点登录（Authentik 授权码流程）
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

用户注册或由管理员创建（未设置密码）后，需通过激活邮件完成账号激活方可登录。管理员创建用户时若提供了密码，用户自动标记为已激活（首次登录仍需强制改密）。

### `AdminUser` 激活相关字段

| 字段 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `activated` | `Boolean` | `false` | 账号是否已激活。`false` 时 `AuthService.login` 拒绝登录并返回 `401 账号尚未激活` |
| `activationToken` | `String` | `""` | 一次性激活令牌（32 字节 hex）。激活完成后清空 |

> 迁移 `add_activation_fields` 将所有存量用户的 `activated` 回填为 `true`，不影响已有账号。

### 激活流程

1. **管理员创建用户（带密码）**→ `activated=true`、`mustChangePassword=true`，用户首次登录需改密
2. **管理员创建用户（不带密码）**→ `activated=false`；管理员通过 `POST /api/users/:id/send-activation` 发送激活邮件，或通过 `PUT /api/users/:id` 传 `{ activated: true }` 手动激活
3. **用户自助注册**（非首个用户）→ `activated=false`，自动发送激活邮件（需 SMTP 配置且提供邮箱）
4. **首个注册用户（管理员）**→ `activated=true`，直接登录
5. 用户点击邮件中的激活链接 → 前端 `/activate?token=xxx`
6. 前端调用 `GET /api/auth/activate-check?token=xxx` 验证令牌
7. 用户设置密码后调用 `POST /api/auth/activate` → 设置密码、`activated=true`、`activationToken=''`、`mustSetupMfa=true`

### API

| Method | Path | Auth | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/users/:id/send-activation` | 管理员 | 生成/重置 activationToken 并发送激活邮件 |
| `PUT` | `/api/users/:id` | 管理员 | Body 含 `{ activated: true }` 时手动激活用户 |
| `GET` | `/api/auth/activate-check?token=xxx` | 公开 | 验证令牌有效性，返回 `{ valid, username }` |
| `POST` | `/api/auth/activate` | 公开 | Body: `{ token, password }`，设置密码并激活 |

### 激活相关审计动作

| Action | 说明 |
| --- | --- |
| `user.send_activation` | 管理员发送/重发激活邮件 |

`GET /api/auth/me` 返回同一字段，便于前端在刷新页面后通过 `/auth/me` 恢复会话时识别强制改密状态。

## OIDC 单点登录（Authentik）

实现位于 `src/oidc/`，通过标准 OpenID Connect 授权码流程接入 Authentik，与本地用户名/密码登录并存。未配置时整个模块降级为「不可用」，不影响其他鉴权路径。

> 面向使用者的 Authentik 侧配置步骤与 `.env` 样例见仓库根目录 `README.md`；本节只描述后端实现细节与契约。

### 模块结构

| 文件 | 职责 |
| --- | --- |
| `oidc.module.ts` | 注册 `OidcService` / `OidcController`，导入 `JwtModule`（复用与本地登录相同的签名配置） |
| `oidc.service.ts` | 启动时拉取发现文档；拼装授权 URL；处理回调（换 token → 取 userinfo → 匹配/创建用户 → 签发 JWT） |
| `oidc.controller.ts` | 暴露 `status` / `login` / `callback` 三个公开端点 |

### 配置装载（`OnModuleInit`）

`OidcService` 在模块初始化时读取环境变量，并请求 `${OIDC_ISSUER}/.well-known/openid-configuration`：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `OIDC_ISSUER` | — | 未设置则打印 warn 并直接禁用，**其余变量都不再读取** |
| `OIDC_CLIENT_ID` | `''` | OAuth2 Client ID |
| `OIDC_CLIENT_SECRET` | `''` | Confidential Client Secret |
| `OIDC_REDIRECT_URI` | `''` | 须与 Authentik 登记值完全一致 |
| `OIDC_ADMIN_GROUP` | `ops-admin` | 映射到 admin 角色的组名 |
| `OIDC_SCOPES` | `openid profile email` | 请求的 scope（`groups` claim 由 `profile` mapping 提供） |
| `OIDC_FRONTEND_URL` | `''` | 回调重定向的前端基址；留空使用相对路径（前后端同域） |

实现要点：

- `issuer` 末尾的连续斜杠会被 `replace(/\/+$/, '')` 去除，避免拼出 `//.well-known/...`；
- 发现文档拉取失败（非 2xx 或抛异常）时打印 error 并将 `config` 重置为 `null`，即**配置有效但发现失败也算整体禁用**；
- `get isEnabled()` 的判定是 `!!(config && discovery)`，`status` 端点与 `login` 端点都依赖它；
- 拉取只在启动时进行一次，无重试、无定时刷新。因此 Authentik 晚于本服务启动时，本服务会持续处于禁用状态，需重启本服务恢复；修改环境变量同样需要重启进程才生效。

### 端点契约

| Method | Path | Auth | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/oidc/status` | 公开 | 返回 `{ enabled: boolean }`，供登录页决定是否渲染 OIDC 按钮 |
| `GET` | `/api/oidc/login` | 公开 | 未启用时返回 `501 { message: 'OIDC not configured' }`；否则下发 `oidc_state` cookie 并 302 到授权端点 |
| `GET` | `/api/oidc/callback` | 公开 | 处理回调，成功/失败**都以 302 收尾**，不返回 JSON 错误 |

`oidc_state` cookie 属性：`httpOnly: true`、`secure: true`、`sameSite: 'lax'`、`path: '/'`、`maxAge: 600_000`（10 分钟）。

> `secure: true` 是硬编码的。这意味着 **OIDC 登录只能在 HTTPS 下工作**：HTTP 站点上浏览器不保存该 cookie，回调时 `req.cookies['oidc_state']` 为 `undefined`，一律判为状态验证失败。本地调试若需绕过，只能临时改代码，不要把它做成环境变量开关。

授权 URL 参数：`response_type=code`、`client_id`、`redirect_uri`、`scope`、`state`。当前实现**未使用 nonce**，也未校验 `id_token` 签名——用户身份完全取自 userinfo 端点的响应，该请求走服务端到服务端的 HTTPS 通道并携带刚换到的 `access_token`。

### 回调处理流程（`handleCallback`）

1. **校验 `code`**：缺失 → 重定向报错「缺少授权码，请重试」；
2. **校验 `state`**：与 cookie 逐字比对，不一致或 cookie 缺失 → 「状态验证失败（Cookie 丢失），请重试」；校验通过后立即 `clearCookie`；
3. **换 token**：`POST` 到 `token_endpoint`，`application/x-www-form-urlencoded`，`grant_type=authorization_code` + `client_secret`。非 2xx 时把响应体写入 error 日志后抛 `InternalServerErrorException('OIDC token exchange failed')`；
4. **取 userinfo**：`Bearer access_token` 请求 `userinfo_endpoint`，读取 `sub` / `preferred_username` / `email` / `name` / `groups`；
5. **定角色**：`groups.includes(OIDC_ADMIN_GROUP) ? 'admin' : 'user'`，精确字符串匹配，`groups` 缺失时视为空数组（即降级为 user）；
6. **匹配或创建用户**（详见下节）；
7. **清除强制流程标记**：若命中的用户仍有 `mustChangePassword` 或 `mustSetupMfa`，一律置 `false`；
8. **签发本地 JWT**：payload 为 `{ sub: user.id, username, role }`，与本地登录完全一致，因此后续所有守卫无需区分登录来源；
9. **写审计**：`auth.oidc_login`，`detail` 为 `groups=<逗号分隔组名>`；
10. **重定向前端**：`{OIDC_FRONTEND_URL}/oidc/callback?token=<jwt>`，未配置前端基址时用相对路径。

`callback` 的整个 `try` 块被包裹，任何异常都取 `err.message` 走 `errorRedirect`，因此上游 Authentik 的错误细节不会直接暴露成 HTTP 500 页面。

### 用户匹配与创建

`AdminUser.oidcSub`（`String @default("")`，见迁移 `add_oidc_sub`）保存 Authentik 用户 ID。

1. 按 `oidcSub` 精确查找已关联用户；
2. 未找到时，用 `preferred_username || email || sub` 作为候选用户名，按 `username` **或** `email` 查找已有本地用户；命中则写入 `oidcSub` 与 `role`，完成关联；
3. 仍未找到则新建用户：

| 字段 | 值 |
| --- | --- |
| `username` | `preferred_username \|\| sub` |
| `email` | `email \|\| ''` |
| `password` | `''`（无本地密码，无法通过密码登录） |
| `oidcSub` | userinfo 的 `sub` |
| `role` | 按组映射 |
| `activated` | `true` |
| `mustChangePassword` / `mustSetupMfa` / `mfaEnabled` | 全部 `false` |

4. 已关联用户在每次登录时按当前 `groups` 同步 `role`（仅在与库中值不同时才写库）。

> 第 2 步是「账号接管」语义：同名或同邮箱的既有本地账号会被 OIDC 身份接管，并按 Authentik 组重设角色。若需保留一个不受 OIDC 影响的本地应急管理员，请确保其 `username` 与 `email` 都不与任何 Authentik 用户相同。
>
> 另注意第 2 步的候选用户名与第 3 步建号时的用户名取值口径不同（前者回退到 `email` 再到 `sub`，后者直接回退到 `sub`），因此仅有 `email` 而无 `preferred_username` 的用户不会被按 email 值创建为同名账号。

### 与强制流程守卫的关系

OIDC 用户建号时即置 `mustChangePassword = mustSetupMfa = false`，且第 7 步会兜底清除，因此永远不会被 `ForceChangePasswordGuard` 或 MFA 强制守卫拦截。这是有意的设计：这两个流程都依赖本地密码，而 OIDC 用户没有本地密码，凭据生命周期由 Authentik 管理。

### 审计动作

| Action | 触发位置 | `userId` | `targetId` | `detail` |
| --- | --- | --- | --- | --- |
| `auth.oidc_login` | `OidcService.handleCallback` 成功路径 | 登录用户 | 登录用户 | `groups=<组列表>` |

失败路径不写审计，仅打 error 日志。排查角色映射问题时，`detail` 里的组列表是判断「问题在 Authentik 侧还是配置侧」的直接依据。

## 升级注意事项

- 升级到包含本特性的版本时执行 `npm run prisma:migrate` 应用 `add_must_change_password` 迁移；
- 迁移会将所有存量用户的 `mustChangePassword` 显式置为 `false`，老用户不会被强制改密；
- 初始管理员（`seed.ts`）与自助注册路径（`/api/auth/register`）同样置 `false`，避免容器首启即陷入「无人能登录改密」的循环。
- OIDC 相关迁移 `add_oidc_sub` 为 `AdminUser` 增加 `oidcSub`（`NOT NULL DEFAULT ''`）并建索引。存量用户该字段为空字符串，不与任何 OIDC 身份关联，现有登录方式不受影响；不配置 `OIDC_ISSUER` 时该字段始终为空。
