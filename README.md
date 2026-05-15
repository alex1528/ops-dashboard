# Ops Dashboard

运维统一入口看板 —— 汇总目标网址及相关资源到统一 Dashboard 页面，支持状态监控、凭据管理和一键直达。

## 技术栈

- **前端**: React 19 + Ant Design 5 + Vite
- **后端**: NestJS + Prisma + SQLite
- **部署**: Docker (单机)

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET、MASTER_KEY、ADMIN_PASSWORD
```

生成密钥:

```bash
# JWT_SECRET
openssl rand -base64 48

# MASTER_KEY (64位 hex)
openssl rand -hex 32
```

### 2. Docker 部署

```bash
docker compose up -d --build
```

访问 <http://localhost:3000>

### 3. 本地开发

后端:

```bash
cd backend
npm install
cp .env.example .env  # 配置环境变量
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run start:dev
```

前端:

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器自动代理 `/api` 到 `http://localhost:3000`。

### 4. 启用 Git 钩子（自动打 Tag）

克隆仓库后执行一次，激活 `.githooks/post-commit` 自动版本 tag：

```bash
git config core.hooksPath .githooks
```

> **注意**：钩子文件已在仓库中设置为可执行权限（`100755`），无需额外 `chmod`。
> 若克隆后钩子不生效，可检查：`git ls-files -s .githooks/post-commit`，确认权限位为 `100755`。

此后每次 `git commit` 都会自动创建递增的语义化版本 tag（如 `v0.0.1`、`v0.0.2`…）并推送至远端 `origin`。

> 若推送失败（无网络），终端会打印警告，手动补推：`git push origin <tag>`

如需跳过单次自动 tag：

```bash
SKIP_AUTO_TAG=1 git commit -m "..."
```

## 默认账户

- 用户名: admin
- 密码: 见 .env 中 ADMIN_PASSWORD
- 角色: 管理员（admin）

## 功能

- ✅ 状态看板：展示所有目标资源的在线状态、响应时间
- ✅ 只读状态页：`/status` 无需登录的简易监控页面，自动刷新
- ✅ 资源管理：新增/编辑/删除目标网址及其分组
- ✅ 凭据管理：每个目标独立的加密凭据存储 (AES-256-GCM)，查看凭据带 loading 反馈；编辑时预先获取凭据再打开弹窗，用户名/密码（星号显示）可靠回显；用户名为空而密码有值时同样正常存取；编辑时两字段均留空则不覆盖已存储值
- ✅ 用户管理：后台新增用户（不支持自注册），支持管理员/普通用户两种角色
- ✅ MFA 两步验证：支持 Google Authenticator 等 TOTP 应用，用户自行绑定/解绑，管理员可重置他人 MFA
- ✅ 邮件通知：管理后台「邮件设置」页面查看 SMTP 状态及发送测试邮件（未配置时自动跳过）
- ✅ 关于页面：「关于」页面展示系统版本号（取自 git tag）、技术栈、功能模块等信息
- ✅ 健康检查：定时 HTTP 探测 + 手动触发，支持按资源关闭（免检默认健康）
- ✅ 移动端适配：响应式布局
- ✅ 操作审计：凭据查看/编辑/用户管理/MFA 操作自动记录
- ✅ 代理自动登录：PocketBase (Beszel)、Certd 适配器 + 通用表单适配器
- ✅ 半自动登录：验证码系统自动预填凭据 + 人工补验证码
- ✅ 反向代理网关：认证注入、HTML 重写、URL 代理重写
- ✅ Docker 容器化：多阶段构建、docker-compose 一键部署
- ✅ 数据库自动备份：增量热备份（仅一份） + 容器重启自动恢复 + 手动备份 API

## 页面路由

| 路径 | 说明 | 需要登录 |
| ---- | ---- | -------- |
| `/` | 完整看板（含一键直达） | 否（查看），是（操作） |
| `/status` | 只读状态监控页 | 否 |
| `/login` | 登录（支持 MFA） | - |
| `/admin/resources` | 资源管理 | 是 |
| `/admin/users` | 用户管理 | 是（仅管理员） |
| `/admin/smtp` | 邮件设置 (SMTP) | 是（仅管理员） |
| `/admin/profile` | 个人设置（MFA 绑定等） | 是 |
| `/admin/about` | 关于系统（版本信息） | 是 |

## API 接口

| 方法 | 路径 | 说明 | 需要登录 |
| ---- | ---- | ---- | -------- |
| `POST` | `/api/backup` | 手动触发数据库备份 | 是 |
| `GET` | `/api/users` | 用户列表 | 是（管理员） |
| `POST` | `/api/users` | 创建用户 | 是（管理员） |
| `PUT` | `/api/users/:id` | 更新用户 | 是（管理员） |
| `DELETE` | `/api/users/:id` | 删除用户 | 是（管理员） |
| `POST` | `/api/mfa/setup` | 生成 MFA 密钥和二维码 | 是 |
| `POST` | `/api/mfa/verify` | 验证并启用 MFA | 是 |
| `POST` | `/api/mfa/disable` | 禁用 MFA | 是 |
| `GET` | `/api/system/version` | 获取系统版本号 | 否 |
| `GET` | `/api/mail/status` | 获取 SMTP 配置状态 | 是（管理员） |
| `POST` | `/api/mail/send` | 发送邮件 | 是（管理员） |
| `POST` | `/api/mail/test` | 发送测试邮件 | 是（管理员） |

## 数据库备份与恢复

### 备份机制

- 容器运行期间，每天凌晨 3 点自动执行 SQLite `VACUUM INTO` 热备份（不中断服务）
- **只保留一份备份文件** `ops-dashboard-backup.db`，保存在宿主机 `./backup/` 目录下（与 `docker-compose.yml` 同级）
- **增量备份**：通过 SHA-256 对比源库与备份文件，内容无变化时跳过写入，避免无意义 IO
- 支持通过 `POST /api/backup` 手动触发备份（需管理员登录）

### 自动恢复

容器启动时（含崩溃重启），`docker-entrypoint.sh` 会在 Prisma 迁移之前检测数据库文件是否存在：

- 若 `ops-dashboard.db` 不存在且 `./backup/ops-dashboard-backup.db` 存在 → 自动复制恢复
- 若无备份文件 → 以全新空库启动（需重新 seed 初始数据）

### 环境变量

| 变量 | 默认值 | 说明 |
| ---- | ---- | ---- |
| `BACKUP_ENABLED` | `true` | 是否启用自动备份 |
| `BACKUP_CRON` | `0 3 * * *` | 备份 cron 表达式 |
| `BACKUP_DIR` | `/app/backup` | 容器内备份目录（已挂载至 `./backup`） |
| `SMTP_HOST` | (empty) | SMTP 服务器地址，留空则禁用邮件功能 |
| `SMTP_PORT` | `465` | SMTP 端口（465=SSL, 587=STARTTLS） |
| `SMTP_USER` | (empty) | SMTP 登录用户 |
| `SMTP_PASS` | (empty) | SMTP 登录密码 |
| `SMTP_FROM` | (SMTP_USER) | 发件人地址 |

### 手动操作

```bash
# 通过 API 手动备份（需 JWT Token）
curl -X POST http://localhost:6000/api/backup \
  -H "Authorization: Bearer <token>"

# 查看备份文件
ls -lh ./backup/ops-dashboard-backup.db

# 手动恢复（停止容器后操作）
docker compose down
docker volume rm ops-dashboard_db-data       # 清空数据卷
docker compose up -d                         # 重启时自动从 backup/ 恢复
```

## 用户管理

- 仅管理员可在后台 `/admin/users` 创建、编辑、删除用户
- 不支持用户自注册，所有用户由管理员后台创建
- 两种角色：
  - **管理员 (admin)**：拥有全部权限，包括用户管理、邮件发送
  - **普通用户 (user)**：可访问资源管理、个人设置等常规功能
- 用户字段：用户名、密码、邮箱、MFA 状态

## MFA 两步验证

- 用户在 `/admin/profile` 自行绑定 MFA
- 支持 Google Authenticator、Microsoft Authenticator 等标准 TOTP 应用
- 绑定流程：生成密钥 → 扫描二维码 → 输入 6 位验证码确认
- 启用后每次登录需额外输入动态验证码
- 用户可输入当前密码自行禁用 MFA
- 管理员可在用户管理页面重置他人 MFA

## 邮件通知

配置 SMTP 环境变量后即可使用邮件发送功能：

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=ops@example.com
SMTP_PASS=your-password
SMTP_FROM=ops@example.com
```

未配置 SMTP 时，邮件功能自动禁用，不影响其他功能正常运行。

## 系统版本

管理后台「关于」页面 (`/admin/about`) 展示当前系统版本号、技术栈和功能模块信息。版本号取自 git tag（由 `.githooks/post-commit` 自动生成并推送）。
