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

此后每次 `git commit` 都会自动创建递增的语义化版本 tag（如 `v0.0.1`、`v0.0.2`…）。

如需跳过单次自动 tag：

```bash
SKIP_AUTO_TAG=1 git commit -m "..."
```

## 默认账户

- 用户名: admin
- 密码: 见 .env 中 ADMIN_PASSWORD

## 功能

- ✅ 状态看板：展示所有目标资源的在线状态、响应时间
- ✅ 只读状态页：`/status` 无需登录的简易监控页面，自动刷新
- ✅ 资源管理：新增/编辑/删除目标网址及其分组
- ✅ 凭据管理：每个目标独立的加密凭据存储 (AES-256-GCM)，编辑时自动回显已存储值
- ✅ 健康检查：定时 HTTP 探测 + 手动触发，支持按资源关闭（免检默认健康）
- ✅ 移动端适配：响应式布局
- ✅ 操作审计：凭据查看/编辑操作自动记录
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
| `/login` | 管理员登录 | - |
| `/admin/resources` | 资源管理 | 是 |

## API 接口

| 方法 | 路径 | 说明 | 需要登录 |
| ---- | ---- | ---- | -------- |
| `POST` | `/api/backup` | 手动触发数据库备份 | 是 |

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
