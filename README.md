# Ops Dashboard

<!-- markdownlint-disable MD013 -->

运维统一入口看板 —— 汇总目标网址及相关资源到统一 Dashboard 页面，支持状态监控、凭据管理和一键直达。

## 技术栈

- **前端**: React 19 + Ant Design 5 + Vite
- **后端**: NestJS + Prisma + SQLite
- **部署**: Docker (单机)

## 快速开始

### 1. 配置环境变量

```bash
# Docker 部署：必须在仓库根目录（与 docker-compose.yml 同级）创建 .env
cp .env.example .env
# 必填：修改 JWT_SECRET、MASTER_KEY、ADMIN_PASSWORD
# 可选：配置 SMTP_HOST 等邮件通知字段
```

> **重要**：本仓库存在两份 `.env`，承担不同角色，**不要混用**：
>
> - 仓库根目录 `.env`（与 `docker-compose.yml` 同级）—— 仅供 Docker Compose 读取并注入到容器环境变量。
> - `backend/.env` —— 仅供本地 `npm run start:dev` / `prisma migrate dev` 等开发命令使用，**不会**被 Docker Compose 读取。
>
> Docker 部署如果缺少根目录 `.env`，`docker compose up` 会因为 `JWT_SECRET` / `MASTER_KEY` / `ADMIN_PASSWORD` 缺失而**直接拒绝启动**（`docker-compose.yml` 中以 `${VAR:?...}` 强校验，给出明确中文报错），避免容器以空配置静默启动后陷入 `MASTER_KEY must be a 64-char hex string` 之类的崩溃循环。

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

- 用户名: admin（由 `.env` 中 `ADMIN_USERNAME` 指定，默认 `admin`）
- 密码: 见 `.env` 中 `ADMIN_PASSWORD`（默认 `admin123`）
- 角色: 管理员（admin）

> **首次部署**：可通过 `npx prisma db seed` 初始化管理员，也可在"允许注册"开启时通过登录页注册首个用户自动获得管理员角色（若 `.env` 已配置 `ADMIN_USERNAME`/`ADMIN_PASSWORD`，首次注册时必须使用该预设账号）。

## 功能

- ✅ 状态看板：展示所有目标资源的在线状态、响应时间；每张卡片底部提供独立的「在新标签页打开」按钮；为避免误点开外部页面，**卡片本身不绑定点击跳转**，所有跳转操作都需点击底部明确的图标按钮；卡片排序严格遵循管理后台拖拽调整后的顺序（groupSortOrder 决定父分组顺序，同一父分组内子分组按其中资源的最小 sortOrder 排列，子分组内资源按 sortOrder 排列），同一分组下所有子分组始终相邻显示；分组标题显示二级层级（分组 / 子分组），子分组为空时显示"分组 / 全部"，`default / 全部` 显示为"未分组"；已登录用户（普通用户及管理员）可在已配置凭据的资源卡片上点击「查看凭据」按钮（未配置凭据时按钮不显示），对已启用 SSH 的资源额外显示「SSH 终端」按钮（点击打开浏览器内 WebTerminal），未登录时功能按钮不显示；普通用户仅可见管理员授权的资源卡片；**所有资源卡片（包括管理员和普通用户添加的）采用统一尺寸**，同一行内卡片等高对齐，长内容自动截断（名称单行省略、URL 最多两行、描述最多两行），底部操作栏始终吸附卡片底部
- ✅ 只读状态页：`/status` 无需登录的简易监控页面，自动刷新；已登录用户（普通用户及管理员）可在状态页查看目标资源凭据，对已启用 SSH 的资源可打开 SSH 终端；排序规则与状态看板一致；已登录普通用户仅可见已授权资源
- ✅ WebTerminal SSH：在浏览器内通过 WebSocket 直接 SSH 登录目标 Linux amd64 服务器（xterm.js + ssh2）；SSH 功能需在资源管理中为该资源单独启用（`sshEnabled=true`）；启用后有私钥凭据时自动使用私钥登录（`ssh -i key.pem root@host`），无私钥时弹出用户名/密码输入框；终端默认在全屏 Modal 中展示，支持一键新标签页打开独立终端页（`/terminal/:id`）；仅登录用户且该资源已启用 SSH 时可见 SSH 按钮，后端 WebSocket 握手验证 JWT，未授权连接自动拒绝
- ✅ 资源管理：新增/编辑/删除目标网址及其分组；支持二级分组（分组 + 子分组），新建资源时分组字段支持从现有分组中搜索选择或输入新分组值（AutoComplete），所有用户均可操作；支持分组和组内资源拖拽排序（基于 @dnd-kit），拖拽结果自动持久化；支持资源所有权机制——管理员创建的资源（ownerId 为空）仅管理员可管理，普通用户创建的资源归属该用户（ownerId=userId）；普通用户可编辑自己拥有的资源以及管理员授权的资源（含更新凭据字段），但仅可删除自己拥有的资源；管理员可管理所有资源（含普通用户创建的）
- ✅ 凭据管理：每个目标独立的加密凭据存储 (AES-256-GCM)，凭据分两部分：**Web系统账号信息**（启用开关 + 用户名/密码/附加信息，用于记录目标资源的Web系统登录信息）和 **Linux SSH凭据**（私钥 PEM + `sshEnabled` 开关，用于 Web Terminal SSH 登录目标服务器）；未配置凭据的资源在状态看板不显示"查看凭据"按钮；私钥支持上传文件(.pem/.key/.txt)或直接粘贴 PEM 内容，查看时私钥内容默认折叠隐藏（点击「显示/隐藏」按钮切换展开），弹窗底部提供「下载私钥(.pem)」按钮；资源管理页"查看凭据"使用页面内受控弹窗展示加载态、空态、错误态和解密后的全部信息（支持一键复制）；兼容历史明文存量凭据读取；编辑时预先获取凭据再打开弹窗，用户名/密码（星号显示）可靠回显；编辑时每个凭据字段独立判断，留空则不更新不覆盖已存储值；解密失败时返回明确错误提示
- ✅ 用户管理：后台新增用户，支持管理员/普通用户两种角色；管理员拥有全部资源的完整访问权限；普通用户需由管理员显式授权可见的资源分组或单个资源（未授权时不可见任何目标）
- ✅ 公开注册：管理员可在「系统设置」页面开启/关闭公开注册开关（默认关闭）；开启后登录页显示注册入口，新用户自行注册为普通用户角色；系统无任何用户时，第一个注册者自动成为管理员（兼容 `.env` 中 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 约束）；非首个用户注册后需通过激活邮件完成账号激活方可登录
- ✅ 邮件激活账号：管理员创建用户时密码可选——提供密码则自动标记为已激活（首次登录仍需强制改密），未设置密码则需通过激活邮件设置密码并激活；自助注册用户同样需邮件激活（首个管理员用户除外）；用户管理页面显示激活状态，支持管理员手动重新发送激活邮件或直接「置为激活」；激活流程包括设置密码（≥8位，含字母和数字）并强制绑定 MFA；未激活用户无法登录
- ✅ 资源权限管理：管理员可在「用户管理」页面为普通用户配置资源访问权限，支持按分组授权（授权整个分组下全部资源）或按单个资源授权；权限采用树形多选 UI（分组→资源层级结构）；被授权的资源，普通用户可查看凭据，且仅在 Web 系统凭据未录入时可首次启用并填写用户名/密码/附加信息（一旦凭据已录入则不可修改），不可修改资源基本信息或 SSH 配置，不可删除资源；前端过滤不可见资源卡片 + 后端凭据 API / SSH WebSocket / 资源编辑 API 三重权限校验，防止越权访问
- ✅ MFA 两步验证：支持 Google Authenticator 等 TOTP 应用，用户自行绑定/解绑，管理员可重置他人 MFA；MFA 密钥在数据库中使用 AES-256-GCM 加密存储（与登录凭据采用相同加密方案），旧版明文密钥自动兼容；新用户首次登录改密后强制绑定 MFA（`mustSetupMfa` 标志），历史未启用 MFA 的用户也会被强制设置
- ✅ 邮件通知：管理后台「邮件设置」页面查看 SMTP 状态及发送测试邮件（未配置时自动跳过）
- ✅ 关于页面：「关于」页面展示系统版本号（取自 git tag）、技术栈、功能模块等信息
- ✅ 前端反馈一致性：Dashboard、登录页及后台管理页面统一通过 Ant Design App 上下文渲染消息提示与信息弹窗，避免 React 19 + Ant Design 5 下静态 message / Modal API 出现“点击无反馈”
- ✅ 健康检查：定时 HTTP 探测 + 手动触发，支持按资源关闭（免检默认健康）；响应时间（responseMs）仅计算实际 HTTP 往返时长，排除重试等待延迟，数据更准确
- ✅ 移动端适配：响应式布局，覆盖运维总览、状态页、登录页、强制改密页与后台管理页：
  - 已设置 `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
  - 卡片网格使用 AntD 栅格断点 `xs={24} sm={12} md={8} lg={6}`，在 360px 单列、≥576px 双列、≥768px 三列、≥992px 四列
  - 后台 `<Sider breakpoint="lg" collapsedWidth={0}>`：屏宽 < 992px 时侧边栏自动收起为汉堡菜单
  - 后台 Header / Content 内边距随断点收紧（768px → 12px、480px → 8px），登录卡片与强制改密卡片在窄屏上以 `max-width: 100%` + `padding: 16px` 自适应
  - 全局 `.ant-modal { max-width: calc(100vw - 16px); }` 与 480px 媒体查询：所有弹窗（凭据查看、用户/资源编辑、SSH 模态等）在小屏不再水平溢出
  - `UsersPage` 等表格使用 `scroll={{ x: 'max-content' }}`，在窄屏下可水平滚动而不挤压列宽
- ✅ 响应式主题（深色 / 浅色 / 跟随系统）：
  - 通过 `ThemeProvider` + AntD `ConfigProvider({ algorithm })` 实现全站主题统一切换；用户选择持久化到 `localStorage`，`auto` 模式下监听 `prefers-color-scheme` 变化
  - `<html data-theme="light|dark">` 属性 + CSS 变量驱动非 AntD 元素（body 背景、登录页、状态页 header 等）的颜色切换
  - 所有页面右上角均放置主题切换按钮（auto → 浅色 → 深色 三态循环）；登录页 / 强制改密页固定右上角；后台在 Header；运维总览与状态页在标题工具栏
  - 终端 UI（SSH Terminal Modal / Terminal Page）按行业惯例**始终保持深色**，不跟随全局主题
  - 个人设置页的 MFA 二维码在深色主题下加白底包裹，保证扫码兼容性，覆盖运维总览、状态页、登录页、强制改密页与后台管理页：
  - 已设置 `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
  - 卡片网格使用 AntD 栅格断点 `xs={24} sm={12} md={8} lg={6}`，在 360px 单列、≥576px 双列、≥768px 三列、≥992px 四列
  - 后台 `<Sider breakpoint="lg" collapsedWidth={0}>`：屏宽 < 992px 时侧边栏自动收起为汉堡菜单
  - 后台 Header / Content 内边距随断点收紧（768px → 12px、480px → 8px），登录卡片与强制改密卡片在窄屏上以 `max-width: 100%` + `padding: 16px` 自适应
  - 全局 `.ant-modal { max-width: calc(100vw - 16px); }` 与 480px 媒体查询：所有弹窗（凭据查看、用户/资源编辑、SSH 模态等）在小屏不再水平溢出
  - `UsersPage` 等表格使用 `scroll={{ x: 'max-content' }}`，在窄屏下可水平滚动而不挤压列宽
- ✅ 操作审计：凭据查看/编辑/用户管理/MFA 操作自动记录
- ✅ 代理自动登录（已移除）：凭据仅作为Web系统账号信息记录存储，不再自动填入目标系统登录表单
- ✅ 反向代理网关（已移除）：所有资源统一通过「在新标签页打开」方式访问
- ✅ Docker 容器化：多阶段构建、docker-compose 一键部署
- ✅ 数据库自动备份：增量热备份（仅一份） + 容器重启自动恢复 + 手动备份 API
- ✅ 状态看板资源卡片 URL 一键复制：每张资源卡片底部新增独立的复制图标按钮，未登录用户也可使用；优先调用 `navigator.clipboard.writeText`，在非安全上下文或旧版浏览器自动降级 `document.execCommand('copy')`；点击事件不会冒泡触发卡片打开；按钮支持键盘 Enter/Space 触发；失败时通过 `messageApi.error` 提示并向控制台输出可定位日志
- ✅ 用户首次登录强制修改密码：管理员创建/重置密码后用户首次登录必须先修改密码方可访问业务接口；新增字段 `AdminUser.mustChangePassword`（是否处于强制改密状态）与 `AdminUser.passwordChangedAt`（最近一次改密时间）；后端 Force_Change_Guard（`ForceChangePasswordGuard`）作为全局守卫拦截除 `/auth/me`、`/auth/me/permissions`、`/auth/change-password`、`/auth/logout` 之外的所有受保护路由（响应 `403 { code: 'MUST_CHANGE_PASSWORD' }`）；前端 Force_Change_Page（`/force-change-password`）提供原密码/新密码/确认新密码三字段表单，强度策略要求长度 ≥ 8 且同时包含字母与数字；前端 `<ForceChangeRouteGuard>` 在路由层强制重定向至改密页；初始管理员（seed）与自助注册用户的 `mustChangePassword` 默认为 `false`，不会被误强制

## 页面路由

| 路径 | 说明 | 需要登录 |
| ---- | ---- | -------- |
| `/` | 完整看板 | 否（查看），是（操作） |
| `/status` | 状态监控页（查看凭据/SSH 需登录） | 否（查看状态），是（查看凭据/SSH） |
| `/login` | 登录 / 注册（支持 MFA） | - |
| `/terminal/:id` | 独立 SSH 终端页（全屏） | 是 |
| `/activate` | 账号激活页（通过邮件链接访问） | 否 |
| `/force-change-password` | 首次登录强制修改密码页 | 是 |
| `/force-setup-mfa` | 强制绑定 MFA 两步验证页 | 是 |
| `/admin/resources` | 资源管理 | 是 |
| `/admin/users` | 用户管理 | 是（仅管理员） |
| `/admin/settings` | 系统设置（注册开关等） | 是（仅管理员） |
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
| `POST` | `/api/users/:id/send-activation` | 发送激活邮件 | 是（管理员） |
| `GET` | `/api/auth/activate-check` | 验证激活令牌是否有效 | 否 |
| `POST` | `/api/auth/activate` | 通过激活令牌设置密码并激活账号 | 否 |
| `POST` | `/api/mfa/setup` | 生成 MFA 密钥和二维码 | 是 |
| `POST` | `/api/mfa/verify` | 验证并启用 MFA | 是 |
| `POST` | `/api/mfa/disable` | 禁用 MFA | 是 |
| `GET` | `/api/system/version` | 获取系统版本号 | 否 |
| `GET` | `/api/system/settings/allow_registration` | 查询是否允许公开注册 | 否 |
| `PUT` | `/api/system/settings/allow_registration` | 设置公开注册开关 | 是（**仅管理员**） |
| `POST` | `/api/auth/register` | 用户公开注册 | 否（受开关控制） |
| `POST` | `/api/auth/change-password` | 修改当前用户密码（成功后清除 `mustChangePassword` 标志） | 是 |
| `GET` | `/api/mail/status` | 获取 SMTP 配置状态 | 是（管理员） |
| `POST` | `/api/mail/send` | 发送邮件 | 是（管理员） |
| `POST` | `/api/mail/test` | 发送测试邮件 | 是（管理员） |
| `PUT` | `/api/resources/reorder/groups` | 批量调整分组显示顺序 | 是 |
| `PUT` | `/api/resources/reorder/items` | 批量调整组内资源顺序 | 是 |
| `GET` | `/api/resources/groups` | 获取所有已使用的分组和子分组列表 | 是 |
| `POST` | `/api/resources/:id/credential/clear` | 清空指定资源的凭据字段 | 是 |
| `WS` | `/ssh` (Socket.IO namespace) | WebTerminal SSH 连接（握手验证 JWT） | 是 |

## CLI 工具

### 清空凭据字段

通过命令行 shell 脚本调用系统 API 接口，清空指定目标资源的用户名、密码或附加信息字段。
脚本默认从项目根目录 `.env` 文件读取 `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`PORT`，无需手动输入凭据（与 `backup-trigger.sh` 行为一致）。

**Linux / macOS (Bash)**：

```bash
chmod +x clear-credential.sh

# 清空指定资源的密码字段（凭据自动从 .env 读取）
./clear-credential.sh -r Beszel -f password

# 清空指定资源的所有凭据字段
./clear-credential.sh -r "聚合DNS" -f all

# 清空附加信息字段
./clear-credential.sh -r Certd -f extra

# 显式指定凭据和服务地址
./clear-credential.sh -r Beszel -f password -u admin -p mypass -H http://myhost:6000
```

**Windows PowerShell**：

```powershell
# 清空指定资源的密码字段（凭据自动从 .env 读取）
.\clear-credential.ps1 -r Beszel -f password

# 清空所有凭据字段
.\clear-credential.ps1 -r "聚合DNS" -f all

# 清空私钥字段
.\clear-credential.ps1 -r Certd -f privateKey

# 显式指定凭据
.\clear-credential.ps1 -r Certd -f extra -u admin -p mypass
```

参数说明：

| 参数 | 说明 |
| ---- | ---- |
| `-r` / `--resource` | 目标资源的名称或 ID |
| `-f` / `--field` | 要清空的字段：`username` \| `password` \| `extra` \| `privateKey` \| `all` |
| `-u` / `--username` | 管理员用户名（可选，默认从 `.env` 读取） |
| `-p` / `--password` | 管理员密码（可选，默认从 `.env` 读取） |
| `-H` / `--host` | 服务地址（可选，默认根据 `.env` 中 PORT 计算） |

> 脚本通过登录 API 获取 JWT Token，查找目标资源后调用 `POST /api/resources/:id/credential/clear` 接口完成清空操作。
> PowerShell 版本保留 `-u` / `-p` / `-H` 短参数别名，默认仍优先从 `.env` 读取管理员凭据和服务地址。
> 对应的 API 接口也可直接通过 curl 或其他 HTTP 客户端调用。

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

## 升级注意事项

### 数据库迁移

升级到包含「首次登录强制修改密码」特性的版本后，需要执行 Prisma migration 才能使用新字段：

- **Docker 部署**：容器启动时 `docker-entrypoint.sh` 会自动执行 `npx prisma migrate deploy`，无需手动操作
- **本地开发**：在 `backend/` 目录下执行 `npx prisma migrate deploy`

### 字段默认值与历史数据兼容

- 新增字段 `AdminUser.mustChangePassword`（默认 `true`）和 `AdminUser.passwordChangedAt`（默认 `NULL`）
- **存量用户**：迁移会将所有已存在的 `AdminUser` 行的 `mustChangePassword` 显式回填为 `false`，避免老用户在升级后被意外强制改密
- **初始管理员**（通过 `prisma db seed` 或 `docker-entrypoint.sh` 创建）：`mustChangePassword` 显式设为 `false`，避免容器首启即陷入「无人能登录改密」的循环
- **公开注册用户**：通过 `/api/auth/register` 自助注册的用户 `mustChangePassword` 显式设为 `false`，注册后需通过激活邮件完成激活（首个管理员用户除外，自动激活并直接登录）
- **管理员后台创建/重置密码**：`UsersService.create` 与 `UsersService.update`（携带 `password` 字段时）会将目标用户的 `mustChangePassword` 翻转为 `true`，触发首次登录强制改密流程
- **邮件激活字段**：新增 `AdminUser.activated`（默认 `false`）和 `AdminUser.activationToken`（默认空字符串）；迁移时所有存量用户的 `activated` 回填为 `true`，不影响已有账号登录；管理员创建用户时密码可选，未设置密码的用户必须通过激活邮件设置密码后方可登录

## 故障排查

### `MASTER_KEY must be a 64-char hex string`（容器启动失败）

容器在加载 `CryptoService` 时检测到 `MASTER_KEY` 缺失或不符合「64 位 hex」格式即拒绝启动，常见根因如下：

| 根因 | 表现 | 处理 |
| --- | --- | --- |
| 仓库根目录缺少 `.env` | Compose 把空字符串注入到容器，Nest 在加载 `CryptoService` 时抛错 | 在仓库根目录复制 `cp .env.example .env`，并填入真实的 `MASTER_KEY` 等必填项 |
| 误将变量写到 `backend/.env` | `backend/.env` 仅供本地 `npm run start:dev` 使用，不会被 Docker Compose 读取 | 把必填项同步到仓库根目录 `.env` |
| `MASTER_KEY` 仍为占位符（含 `CHANGE_ME`） | Nest 抛错「仍为占位符」 | 用 `openssl rand -hex 32` 重新生成 |
| `MASTER_KEY` 长度不是 64 / 含非 hex 字符 | Nest 抛错「长度应为 64 位 hex」或「必须是 64 位 hex 字符串」 | 重新生成；该值的语义是 32 字节 = 64 位十六进制字符（`0-9 / a-f`） |

为减少此类失误，本项目从此版本起做了三层防护：

1. `docker-compose.yml` 对 `JWT_SECRET` / `MASTER_KEY` / `ADMIN_PASSWORD` 使用 `${VAR:?...}` 强校验，缺失时 Compose 自身会以非零退出，给出中文报错；
2. `docker-entrypoint.sh` 在 `prisma migrate deploy` 之前再做一次 shell 层校验，输出可定位的中文错误并 `exit 1`；
3. `CryptoService` 把诊断拆分为「未设置 / 占位符 / 长度错 / 含非 hex」四类中文错误，便于排查。

> 注：`docker-compose.yml` 中带 `${VAR:?中文消息}` 的 environment 条目必须用双引号整体包裹（如 `"MASTER_KEY=${MASTER_KEY:?...}"`），否则消息中的中文标点（如`:`）会被 YAML 解析为映射分隔符，触发 `services.ops-dashboard.environment.[N]: unexpected type map[string]interface {}`。
> 任何错误信息都只引用变量名，不会回显 `MASTER_KEY` / `JWT_SECRET` / `ADMIN_PASSWORD` 的真实值。

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
- 启用后每次登录需额外输入动态验证码；验证界面采用独立安全视觉样式（渐变图标 + 居中等宽输入框），响应式适配移动端
- **强制绑定 MFA**：新用户首次登录改密后、历史未启用 MFA 的用户下次登录时，系统强制跳转到 `/force-setup-mfa` 页面完成 MFA 绑定后才能使用业务功能；后端 `ForceMfaGuard` 全局守卫拦截，前端 `<ForceMfaRouteGuard>` + axios 拦截器双重保障
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

## WebTerminal SSH

在浏览器内通过 WebSocket 直接 SSH 登录目标 Linux 服务器，无需安装任何客户端。

### 使用方式

1. 在资源管理（`/admin/resources`）编辑目标资源，在「Linux SSH凭据(Web Terminal)」区域开启**「启用Web Terminal(SSH)」**开关
2. 开关开启后，上传或粘贴该服务器的 PEM 私钥，保存
3. 在 Dashboard（`/`）或状态页（`/status`）的资源卡片底部，已登录用户在**已启用 SSH 的资源**上可看到 **`</>`（SSH 终端）** 按钮
4. 点击按钮后：
   - **有私钥凭据**：自动使用存储的 PEM 私钥建立 SSH 连接（等效于 `ssh -i key.pem root@host`），无需任何输入
   - **无私钥凭据**（仅启用了开关但未上传私钥）：弹出用户名/密码输入框（用户名默认 `root`），填写后点击「连接」
5. 终端默认在全屏 Modal 中展示，点击右上角 **⤢** 图标可在新标签页（`/terminal/:id`）独立打开

### 技术实现

- **前端**：`@xterm/xterm` + `@xterm/addon-fit` 渲染终端，`socket.io-client` 建立 WebSocket 连接
- **后端**：NestJS `@WebSocketGateway` (`/ssh` namespace) + `ssh2` 库建立 SSH 连接；终端输出使用 `utf8` 编码，正确显示中文及 ANSI 颜色序列
- **认证**：WebSocket 握手时验证 JWT Token（从 `handshake.auth.token` 读取），未登录连接自动拒绝
- **私钥安全**：私钥在后端解密后直接传给 `ssh2`，不经过前端传输
- **凭据区分**：`credWebEnabled + username/password` 为 Web 系统账号信息（仅记录用途）；`privateKey + sshEnabled` 为 Linux SSH凭据，两者共存于同一 Credential 记录但语义不同，均通过各自的启用开关控制；两个开关同时关闭时凭据记录会被自动删除
- **SSH 启用控制**：`Credential.sshEnabled` 字段（默认 `false`），只有管理员显式开启后，前端才显示 SSH 按钮，后端才接受该资源的 SSH 连接请求
- **SSH 主机**：从资源 `url` 字段解析 hostname（如 `https://ga.anytoken.cloud` → `ga.anytoken.cloud`），端口固定 22
- **SSH 用户名**：固定 `root`（密码模式下用户可自定义）
- **PTY 尺寸同步**：前端在建立连接时携带实际终端尺寸（`cols/rows`）初始化 PTY；xterm.js 挂载后立即发送 `ssh:resize` 修正尺寸；若 socket `connect` 事件先于 xterm 渲染触发，则暂存 payload 待 xterm 就绪后再发出，确保 `ls`、`top`、`htop` 等命令输出不错位

### WebSocket 事件

| 方向 | 事件 | 数据 | 说明 |
| ------ | ------ | ------ | ------ |
| 客户端 → 服务端 | `ssh:connect` | `{ resourceId, username?, password?, cols?, rows? }` | 发起 SSH 连接（携带终端尺寸） |
| 客户端 → 服务端 | `ssh:data` | `{ data: string }` | 键盘输入 |
| 客户端 → 服务端 | `ssh:resize` | `{ cols, rows }` | 调整终端窗口大小 |
| 客户端 → 服务端 | `ssh:disconnect` | — | 主动断开 |
| 服务端 → 客户端 | `ssh:data` | `{ data: string }` | 终端输出（UTF-8 编码） |
| 服务端 → 客户端 | `ssh:error` | `{ message: string }` | 错误信息 |
| 服务端 → 客户端 | `ssh:close` | `{ message: string }` | 连接关闭通知 |

## 系统版本

管理后台「关于」页面 (`/admin/about`) 展示当前系统版本号、技术栈和功能模块信息。

版本号获取优先级：

1. **Docker 部署**：构建时通过 `APP_VERSION` 参数注入，使用 [build.sh](build.sh) / [build.ps1](build.ps1) 脚本可自动获取最新的语义化 tag（按版本号倒序，非 `git describe` 的可达性）
2. **本地开发**：运行时优先 `git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname`（与构建脚本、`post-commit` 钩子一致，避免在多分支/sibling tag 下漏掉最新版本），失败则回退到 `git describe --tags --abbrev=0`，再回退到 `git tag --sort=-v:refname`
3. **回退值**：以上均不可用时显示 `dev`，关于页面标注"(本地开发模式)"
