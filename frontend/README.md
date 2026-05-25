# Ops Dashboard 前端

基于 **React 19 + Ant Design 5 + Vite 6** 的单页应用，覆盖运维总览、状态监控、资源/用户管理、个人设置、SSH 终端等页面，以及「资源 URL 一键复制」、「首次登录强制改密」、「强制绑定 MFA」和「二级分组」流程。

> 当前目录的所有路径均相对于 `frontend/`。

## 目录结构（关键节点）

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx                # 运维总览（资源卡片）
│   │   ├── StatusPage.tsx               # 状态监控（资源卡片）
│   │   ├── Login.tsx                    # 登录页
│   │   ├── ForceChangePassword.tsx      # 首次登录强制改密页
│   │   ├── ForceMfaSetup.tsx            # 强制绑定 MFA 页
│   │   └── ...                          # AdminLayout、UsersPage、ProfilePage 等
│   ├── components/
│   │   ├── CopyButton.tsx               # 通用「复制 URL」按钮
│   │   └── SshTerminalModal.tsx
│   ├── utils/
│   │   └── clipboard.ts                 # Clipboard_Service 封装
│   ├── auth.tsx                         # AuthProvider / useAuth（含 markMfaSetupComplete）
│   ├── api.ts                           # axios 实例与拦截器（含 MUST_SETUP_MFA 处理）
│   └── App.tsx                          # 路由 + ForceChangeRouteGuard + ForceMfaRouteGuard
├── package.json
└── vite.config.ts
```

## 运行脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（默认 5173） |
| `npm run build` | `tsc -b && vite build`，输出到 `dist/` |
| `npm run preview` | 预览 `npm run build` 后的产物 |

## 资源卡片 URL 一键复制

Status_Dashboard 中的资源卡片（`Dashboard.tsx` / `StatusPage.tsx`）在底部操作区会插入一个独立的复制按钮，点击即把 `resource.url` 写入系统剪贴板，并通过 Ant Design `messageApi` 给出反馈。点击不会冒泡到卡片本体，因此不会触发「打开链接」等交互。

### `utils/clipboard.ts`

```ts
import { copyToClipboard } from '../utils/clipboard';

const result = await copyToClipboard(url);
if (result.ok) {
  // success
} else {
  // result.reason: 'empty' | 'unsupported' | 'denied' | 'unknown'
}
```

返回值类型：

```ts
type CopyResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'unsupported' | 'denied' | 'unknown'; cause?: unknown };
```

实现要点：

- **空白短路**：当 `text` 不是字符串、空字符串或仅含空白字符（`/^\s*$/`）时，直接返回 `{ ok: false, reason: 'empty' }`，**不调用任何剪贴板 API、不打印 `console.error`**。
- **主路径**：当 `navigator.clipboard.writeText` 存在且 `window.isSecureContext === true` 时，优先调用它。
- **降级路径**：主路径不可用或失败时，创建临时 `<textarea>` 挂载到 `document.body`，`select()` + `setSelectionRange(0, text.length)` 后调用 `document.execCommand('copy')`；最终 `removeChild` 并把焦点还原到调用前的 `document.activeElement`。
- **失败原因映射**：`reason: 'denied'` 来自 `NotAllowedError` 类型的 `DOMException`；`reason: 'unsupported'` 表示主、降级两条路径都不可用；其他失败统一映射为 `reason: 'unknown'`。
- **错误日志**：所有捕获到的异常都会通过 `console.error('[clipboard]', cause)` 输出，便于浏览器控制台定位。

### `components/CopyButton.tsx`

```tsx
import CopyButton from '../components/CopyButton';

<CopyButton
  text={resource.url}
  title="复制链接"
  ariaLabel="复制链接"
  onCopied={() => {/* 可选埋点 */}}
/>
```

#### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `text` | `string` | 必填 | 待复制的文本（一般是 `resource.url`） |
| `title` | `string?` | `'复制链接'` | Tooltip 文案 |
| `ariaLabel` | `string?` | `'复制链接'` | 控件的 `aria-label`（成功瞬时态会临时切换为 `'已复制'`） |
| `onCopied` | `() => void` | `undefined` | 复制成功后的可选回调，便于埋点 |

#### 行为约定

- 当 `text` 为空字符串或仅包含空白字符时，渲染禁用态 `<Button disabled>`，且不绑定任何点击/键盘处理。
- `onClick` 内先 `e.stopPropagation()` + `e.preventDefault()` 阻止事件冒泡到卡片容器，再调用 `copyToClipboard(text)`：
  - **成功** → `messageApi.success('已复制链接到剪贴板')`，并将图标在 1500 ms 内切换为 `<CheckOutlined />`，同时把 `aria-label` 临时切换为 `'已复制'`。
  - **失败**（且 `reason !== 'empty'`） → `messageApi.error('复制失败，请手动选择 URL 复制')`。
- `onKeyDown` 显式处理 `Enter` 与 `Space`：阻止默认的页面滚动行为后触发与点击等价的复制处理（无障碍可达性要求）。
- 视觉风格：`<Button type="text" size="small">` + `<CopyOutlined />` / `<CheckOutlined />`，与卡片底部既有按钮一致。

## 首次登录强制修改密码

当后端 `user.mustChangePassword === true` 时，前端通过 AuthContext + 路由守卫 + axios 拦截器三层协同，把用户引导到 `/force-change-password` 页面，并在改密前阻止访问其他业务页面。

### `auth.tsx`

`UserInfo` 类型扩展：

```ts
interface UserInfo {
  id: string;
  username: string;
  role: string;
  email: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  mustSetupMfa: boolean;
}
```

`AuthContext` 暴露的 `markPasswordChanged()` 方法：

```ts
const { markPasswordChanged } = useAuth();
// 在 POST /api/auth/change-password 成功后调用
markPasswordChanged();
```

实现等价于：

```ts
const markPasswordChanged = useCallback(() => {
  setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
}, []);
```

它**只**翻转本地状态，避免改密成功后再多一次 `/auth/me` 往返。该字段也会在登录响应与启动时 `GET /auth/me` 恢复会话的过程中自动写入到 `user`。

### `<ForceChangeRouteGuard>`（位于 `App.tsx`）

```tsx
function ForceChangeRouteGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  const whitelist = ['/force-change-password', '/login'];
  if (user?.mustChangePassword === true && !whitelist.includes(loc.pathname)) {
    return <Navigate to="/force-change-password" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}
```

行为约定：

- 当 `user?.mustChangePassword === true` 且当前 `location.pathname` 不在白名单 `['/force-change-password', '/login']` 时，重定向到 `/force-change-password`，并通过 `state.from` 记录原路径，用于改密成功后回跳。
- 未登录用户（`!user`）不受影响，仍可访问 `/`、`/status`、`/login` 等公开路由。
- 该守卫包裹整棵 `<Routes>` 树，保证应用级所有路由跳转都会经过它。

### `/force-change-password` 路由 → `pages/ForceChangePassword.tsx`

三字段表单（与后端 `assertPasswordStrength` 保持一致的强度策略）：

| 字段 | 校验规则 | 错误文案 |
| --- | --- | --- |
| `oldPassword` | 必填 | `请输入原密码` |
| `newPassword` | 必填；`min: 8`；正则 `/^(?=.*[A-Za-z])(?=.*\d).+$/`；不得等于 `oldPassword` | `请输入新密码` / `密码至少 8 位且需同时包含字母和数字` / `新密码不能与原密码相同` |
| `confirmPassword` | 必填；必须等于 `newPassword` | `请再次输入新密码` / `两次输入的密码不一致` |

提交流程：

1. 前端校验通过后调用 `api.post('/auth/change-password', { oldPassword, newPassword })`；
2. **成功** → `markPasswordChanged()` + `messageApi.success('密码修改成功')` + `nav(redirectTo ?? '/', { replace: true })`，其中 `redirectTo = useLocation().state?.from`；
3. **失败** → `messageApi.error(err.response?.data?.message ?? '密码修改失败，请稍后重试')`，停留在当前页（不离开 `/force-change-password`）。

页面同时提供「退出登录」次按钮：调用 `useAuth().logout()` 后 `nav('/login')`，避免用户陷入死锁。

### `api.ts` 拦截器对 `403 MUST_CHANGE_PASSWORD` 的兜底

```ts
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    if (status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (
      status === 403 &&
      data?.code === 'MUST_CHANGE_PASSWORD' &&
      window.location.pathname !== '/force-change-password'
    ) {
      window.location.href = '/force-change-password';
    }
    return Promise.reject(err);
  },
);
```

任何业务接口（不论是否走过 `<ForceChangeRouteGuard>`）一旦命中后端 `ForceChangePasswordGuard` 返回的 `403 { code: 'MUST_CHANGE_PASSWORD' }`，axios 拦截器就会立即把浏览器导航到 `/force-change-password`；条件 `pathname !== '/force-change-password'` 用于避免在改密页内自身循环跳转。

## 与后端契约一致性

前端密码强度策略、错误文案、`/force-change-password` 路由跳转条件，都与后端保持一一对应：

- 强度策略：长度 ≥ 8 且同时包含字母与数字；
- 文案：`原密码错误` / `新密码不能与原密码相同` / `新密码长度不能少于 8 位` / `新密码必须同时包含字母与数字` / 通用兜底 `密码修改失败，请稍后重试`；
- 拦截语义：`{ code: 'MUST_CHANGE_PASSWORD', message: '请先修改初始密码' }` HTTP 403。

如需进一步了解后端字段流转、守卫白名单与审计动作，可参考 `backend/README.md` 中「首次登录强制修改密码」一节。

## 强制绑定 MFA 两步验证

用户完成首次改密后，若 `mustSetupMfa === true` 且 `mfaEnabled === false`，前端通过 `<ForceMfaRouteGuard>` + axios 拦截器（`403 { code: 'MUST_SETUP_MFA' }`）引导至 `/force-setup-mfa` 页面。

### `<ForceMfaRouteGuard>`（位于 `App.tsx`）

包裹在 `<ForceChangeRouteGuard>` 内层，确保改密优先于 MFA：

- 当 `!user.mustChangePassword && !user.mfaEnabled && user.mustSetupMfa === true` 时重定向到 `/force-setup-mfa`
- 白名单：`/force-setup-mfa`、`/force-change-password`、`/login`

### `pages/ForceMfaSetup.tsx`

两阶段交互：

1. **初始态**：展示说明文案 + 「开始设置 MFA」按钮，点击调用 `POST /api/mfa/setup` 获取二维码
2. **绑定态**：展示 TOTP 二维码（QR Code）+ 6 位验证码输入框；验证成功后调用 `markMfaSetupComplete()` 翻转本地状态，跳转回业务页面

### `auth.tsx` 中的 `markMfaSetupComplete()`

```ts
const markMfaSetupComplete = useCallback(() => {
  setUser((u) => (u ? { ...u, mustSetupMfa: false, mfaEnabled: true } : u));
}, []);
```

### `api.ts` 拦截器对 `403 MUST_SETUP_MFA` 的兜底

与改密拦截器同级，当任何请求返回 `403 { code: 'MUST_SETUP_MFA' }` 时，自动跳转到 `/force-setup-mfa`。

## 二级分组（分组 + 子分组）

资源管理表单中的分组字段使用 `<AutoComplete>` 组件，支持从现有值中搜索选择或输入新值：

- **分组**：调用 `GET /api/resources/groups` 获取所有已使用的分组列表作为选项数据源
- **子分组**：根据当前选定的分组动态过滤该分组下的子分组列表
- 状态看板和状态页分组标题显示二级层级："分组 / 子分组"，子分组为空时显示"分组 / 全部"，`default / 全部` 显示为"未分组"

## 资源卡片点击行为

为避免在状态看板留白处误点击触发跳转，**资源卡片整体不绑定 onClick / hoverable**：所有跳转、复制、查看凭据、SSH 终端等操作都通过底部独立的图标按钮显式触发，按钮内部统一调用 `e.stopPropagation()` + `e.preventDefault()` 阻止事件冒泡，互不干扰。

| 按钮 | 图标 | 行为 |
| --- | --- | --- |
| 复制链接 | `<CopyOutlined />` | 把 `resource.url` 写入剪贴板，未登录用户也可使用 |
| 查看凭据 | `<EyeOutlined />` | 已登录用户且资源已配置凭据时显示，拉取并展示加密凭据 |
| SSH 终端 | `<CodeOutlined />` | 已登录且资源 `sshEnabled` 时，打开浏览器内 SSH 终端 |
| 打开链接 | `<LinkOutlined />` | 在新标签页打开资源 URL |

## 响应式设计

- 已设置 `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
- 卡片网格使用 AntD 栅格断点 `<Col xs={24} sm={12} md={8} lg={6} />`：360px 单列、≥576px 双列、≥768px 三列、≥992px 四列
- 后台 `<Sider breakpoint="lg" collapsedWidth={0}>`：屏宽 < 992px 时侧边栏自动收起为汉堡菜单
- 后台 Header / Content 内边距随断点收紧（768px → 12px，480px → 8px），登录卡片与强制改密卡片在窄屏上以 `max-width: 100%` + `padding: 16px` 自适应
- 全局 `.ant-modal { max-width: calc(100vw - 16px); }` 与 480px 媒体查询：所有 AntD 弹窗在小屏不再水平溢出
- `UsersPage` 等表格使用 `scroll={{ x: 'max-content' }}` 在窄屏下水平滚动，不挤压列宽

如需新增页面或组件，请遵循以上断点策略，并在 `index.css` 中按 768px / 480px 两档收紧 padding/margin/字体即可。

## 响应式主题（深色 / 浅色 / 跟随系统）

主题系统由 `src/theme.tsx` 与 `src/components/ThemeToggle.tsx` 实现，配合 `main.tsx` 中的 `ConfigProvider` 桥接 AntD 设计 token。

### 架构

```
ThemeProvider (theme.tsx)
  ├─ mode: 'auto' | 'light' | 'dark'        ← 用户选择，持久化到 localStorage
  ├─ resolvedMode: 'light' | 'dark'         ← 解析后实际值（auto 时跟随 prefers-color-scheme）
  └─ setMode / cycleMode                     ← 切换 API
       │
       ▼
<html data-theme="light|dark">              ← 让 index.css 中的 CSS 变量切换
       │
       ▼
<ConfigProvider theme={{ algorithm: dark/default }}>  ← AntD 组件主题
```

### `useTheme()`

```ts
import { useTheme } from '../theme';

const { mode, resolvedMode, setMode, cycleMode } = useTheme();
// mode === 'auto' | 'light' | 'dark'
// resolvedMode === 'light' | 'dark'  （auto 已被解析）
```

### `<ThemeToggle />`

单按钮三态切换：auto → light → dark → auto，已集成在以下位置，确保任何视图都能切主题：

| 位置 | 文件 |
| --- | --- |
| 后台 Header（已登录用户） | `pages/AdminLayout.tsx` |
| 运维总览右上角工具栏 | `pages/Dashboard.tsx` |
| 状态页 header 右侧 | `pages/StatusPage.tsx` |
| 登录页右上角（未登录） | `pages/Login.tsx` |
| 强制改密页右上角 | `pages/ForceChangePassword.tsx` |

### CSS 变量

`index.css` 在 `:root[data-theme='light']` / `:root[data-theme='dark']` 下定义同名变量，所有页面颜色都通过变量读取。如需新增页面，请使用以下变量而不是写死颜色：

| 变量 | 用途 |
| --- | --- |
| `--app-bg` | 全局页面背景（body / login-page / app-loading） |
| `--surface-bg` / `--surface-bg-soft` / `--surface-bg-muted` | 表面层 / 弱表面层 / 拖拽高亮 |
| `--border-color` / `--border-color-strong` | 边框 |
| `--text-primary` / `--text-secondary` / `--text-tertiary` / `--text-quaternary` | 文字四级层级 |
| `--header-bg` | 后台 Header 背景 |
| `--status-header-bg` / `--status-header-text` / `--status-header-text-soft` | 状态页 hero 渐变与文字 |
| `--status-group-label` | 状态页分组小标题 |

### 不跟随主题的区域

- **SSH 终端 Modal / Terminal Page**：按行业惯例始终深色，不读取上述变量，硬编码 `#0d0d1a` / `#1a1a2e`。
- **MFA 二维码**：在深色主题下加白底 `padding: 8px` 包裹，保证扫码识别率。
- **Sider 菜单**：保持 `theme="dark"`（AntD 经典默认），与浅色主体形成对比，并避免菜单图标在浅色背景下不易辨识。
