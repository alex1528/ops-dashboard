# Ops Dashboard 前端

基于 **React 19 + Ant Design 5 + Vite 6** 的单页应用，覆盖运维总览、状态监控、资源/用户管理、个人设置、SSH 终端等页面，以及本特性新增的「资源 URL 一键复制」与「首次登录强制改密」流程。

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
│   │   └── ...                          # AdminLayout、UsersPage、ProfilePage 等
│   ├── components/
│   │   ├── CopyButton.tsx               # 通用「复制 URL」按钮
│   │   └── SshTerminalModal.tsx
│   ├── utils/
│   │   └── clipboard.ts                 # Clipboard_Service 封装
│   ├── auth.tsx                         # AuthProvider / useAuth
│   ├── api.ts                           # axios 实例与拦截器
│   └── App.tsx                          # 路由 + ForceChangeRouteGuard
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

Status_Dashboard 中的资源卡片（`Dashboard.tsx` / `StatusPage.tsx`）在底部操作区会插入一个独立的复制按钮，点击即把 `resource.url` 写入系统剪贴板，并通过 Ant Design `messageApi` 给出反馈。点击不会冒泡到卡片本体，因此不会触发原有的「打开链接 / 自动登录」交互。

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
