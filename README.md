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
# 必填：修改 JWT_SECRET、MASTER_KEY、ADMIN_PASSWORD
# 可选：配置 SMTP_HOST 等邮件通知字段
```

生成密钥:

```bash
# JWT_SECRET
openssl rand -base64 48

# MASTER_KEY (64位 hex)
openssl rand -hex 32
```

### 2. Docker 部署

**构建镜像**（前后端均在 Docker 多阶段构建中完成，自动注入版本号）：

```bash
# Linux / macOS — 推荐使用构建脚本（自动获取 git tag）
./build.sh --no-cache

# Windows PowerShell
.\build.ps1 --no-cache

# 手动指定版本号
APP_VERSION=v1.0.0 docker compose build --no-cache
```

**启动服务**：

```bash
docker compose up -d
```

> 镜像构建完成后，`docker-compose.yml` 中的 `build:` 段可选删除，直接使用已构建的 `ops-dashboard:latest` 镜像运行。
> 也可通过 `docker build -t ops-dashboard:latest --build-arg APP_VERSION=v1.0.0 .` 单独构建镜像。

访问 <http://localhost:6000>

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

克隆仓库后执行一次，激活 `.githooks/post-commit` 自动版本 tag 并配置 tag 随分支自动推送：

```bash
git config core.hooksPath .githooks
git config push.followTags true
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
- ✅ 只读状态页：`/status` 无需登录的简易监控页面，自动刷新；已登录用户（普通用户及管理员）可在状态页查看目标资源凭据
- ✅ 资源管理：新增/编辑/删除目标网址及其分组
- ✅ 凭据管理：每个目标独立的加密凭据存储 (AES-256-GCM)，资源管理页"查看凭据"使用页面内受控弹窗展示加载态、空态、错误态和解密后的用户名/密码/附加信息（支持一键复制），避免 React 19 + Ant Design 静态弹窗失效导致"点击无反馈"；兼容历史明文存量凭据读取；编辑时预先获取凭据再打开弹窗，用户名/密码（星号显示）可靠回显；用户名为空而密码有值时同样正常存取；编辑时每个凭据字段独立判断，留空则不更新不覆盖已存储值；正确识别加密空字符串格式避免回显异常；解密失败时返回明确错误提示
- ✅ 用户管理：后台新增用户（不支持自注册），支持管理员/普通用户两种角色
- ✅ MFA 两步验证：支持 Google Authenticator 等 TOTP 应用，用户自行绑定/解绑，管理员可重置他人 MFA；MFA 密钥在数据库中使用 AES-256-GCM 加密存储（与登录凭据采用相同加密方案），旧版明文密钥自动兼容
- ✅ 邮件通知：管理后台「邮件设置」页面查看 SMTP 状态及发送测试邮件（未配置时自动跳过）
- ✅ 关于页面：「关于」页面展示系统版本号（取自 git tag）、技术栈、功能模块等信息
- ✅ 前端反馈一致性：Dashboard、登录页及后台管理页面统一通过 Ant Design App 上下文渲染消息提示与信息弹窗，避免 React 19 + Ant Design 5 下静态 message / Modal API 出现“点击无反馈”
- ✅ 健康检查：定时 HTTP 探测 + 手动触发，支持按资源关闭（免检默认健康）；响应时间（responseMs）仅计算实际 HTTP 往返时长，排除重试等待延迟，数据更准确
- ✅ 移动端适配：响应式布局
- ✅ 操作审计：凭据查看/编辑/用户管理/MFA 操作自动记录
- ✅ 代理自动登录：PocketBase (Beszel)、Certd 适配器 + 通用表单适配器；凭据解密同样支持历史明文兼容，与资源管理模块行为一致
- ✅ 半自动登录：验证码系统自动预填凭据 + 人工补验证码
- ✅ 反向代理网关：认证注入、HTML 重写、URL 代理重写
- ✅ Docker 容器化：多阶段构建、docker-compose 一键部署
- ✅ 数据库自动备份：增量热备份（仅一份） + 容器重启自动恢复 + 手动备份 API

## 页面路由

| 路径 | 说明 | 需要登录 |
| ---- | ---- | -------- |
| `/` | 完整看板（含一键直达） | 否（查看），是（操作） |
| `/status` | 状态监控页（查看凭据需登录） | 否（查看状态），是（查看凭据） |
| `/login` | 登录（支持 MFA） | - |
| `/admin/resources` | 资源管理 | 是 |
| `/admin/users` | 用户管理 | 是（仅管理员） |
| `/admin/smtp` | 邮件设置 (SMTP) | 是（仅管理员） |
| `/admin/profile` | 个人设置（MFA 绑定等） | 是 |
| `/admin/about` | 关于系统（版本信息） | 是 |

## API 接口

| 方法 | 路径 | 说明 | 需要登录 |
| ---- | ---- | ---- | -------- |
| `POST` | `/api/backup` | 手动触发数据库备份 | 是（**仅管理员**） |
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
- 若无备份文件 → 以全新空库启动

迁移完成后自动运行 seed 脚本：

- 若指定用户名（`ADMIN_USERNAME`）不存在 → 创建并赋予 `admin` 角色
- 若已存在但角色非 `admin` → 自动升级为 `admin` 角色（解决旧版迁移将 role 默认为 "user" 的兼容问题）
- 若已存在且角色为 `admin` → 跳过

### 环境变量

| 变量 | 默认值 | 说明 |
| ---- | ---- | ---- |
| `CORS_ORIGIN` | (空，反射请求来源) | 生产环境建议设为看板访问域名（如 `https://ops.example.com`），避免 CORS 请求来源过宽 |
| `BACKUP_ENABLED` | `true` | 是否启用自动备份 |
| `BACKUP_CRON` | `0 3 * * *` | 备份 cron 表达式 |
| `BACKUP_DIR` | `/app/backup` | 容器内备份目录（已挂载至 `./backup`） |
| `SMTP_HOST` | (empty) | SMTP 服务器地址，留空则禁用邮件功能 |
| `SMTP_PORT` | `465` | SMTP 端口（465=SSL, 587=STARTTLS） |
| `SMTP_USER` | (empty) | SMTP 登录用户 |
| `SMTP_PASS` | (empty) | SMTP 登录密码 |
| `SMTP_FROM` | (SMTP_USER) | 发件人地址 |
| `APP_VERSION` | `dev` | 系统版本号（Docker 构建时通过 build arg 注入） |

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
- 初始管理员账号 `admin` 由系统自动创建，始终为列表第一项
- 两种角色：
  - **管理员 (admin)**：拥有全部权限，包括用户管理、邮件发送
  - **普通用户 (user)**：可访问资源管理、个人设置等常规功能
- 用户字段均可编辑：邮箱、角色、密码（留空不修改）
- 安全保护：系统中最后一个管理员账号不可被删除，防止系统失去管理入口

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

管理后台「关于」页面 (`/admin/about`) 展示当前系统版本号、技术栈和功能模块信息。

版本号获取优先级：

1. **Docker 部署**：构建时通过 `APP_VERSION` 参数注入，使用 [build.sh](build.sh) / [build.ps1](build.ps1) 脚本可自动获取 git tag
2. **本地开发**：运行时自动读取 `git describe --tags --abbrev=0`（使用 `shell: true` + 仓库根目录 `cwd` 确保 Windows/macOS/Linux 兼容），若失败则通过 `git tag --sort=-v:refname` 获取最新标签
3. **回退值**：以上均不可用时显示 `dev`，关于页面标注"(本地开发模式)"
