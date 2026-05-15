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

## 默认账户

- 用户名: admin
- 密码: 见 .env 中 ADMIN_PASSWORD

## 功能

- ✅ 状态看板：展示所有目标资源的在线状态、响应时间
- ✅ 只读状态页：`/status` 无需登录的简易监控页面，自动刷新
- ✅ 资源管理：新增/编辑/删除目标网址及其分组
- ✅ 凭据管理：每个目标独立的加密凭据存储 (AES-256-GCM)
- ✅ 健康检查：定时 HTTP 探测 + 手动触发，支持按资源关闭（免检默认健康）
- ✅ 移动端适配：响应式布局
- ✅ 操作审计：凭据查看/编辑操作自动记录
- ✅ 代理自动登录：PocketBase (Beszel)、Certd 适配器 + 通用表单适配器
- ✅ 半自动登录：验证码系统自动预填凭据 + 人工补验证码
- ✅ 反向代理网关：认证注入、HTML 重写、URL 代理重写
- ✅ Docker 容器化：多阶段构建、docker-compose 一键部署

## 页面路由

| 路径 | 说明 | 需要登录 |
| ---- | ---- | -------- |
| `/` | 完整看板（含一键直达） | 否（查看），是（操作） |
| `/status` | 只读状态监控页 | 否 |
| `/login` | 管理员登录 | - |
| `/admin/resources` | 资源管理 | 是 |
