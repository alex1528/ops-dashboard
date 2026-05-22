import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { useAuth } from './auth';
import Dashboard from './pages/Dashboard';
import StatusPage from './pages/StatusPage';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import ResourcesPage from './pages/ResourcesPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import SmtpPage from './pages/SmtpPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import TerminalPage from './pages/TerminalPage';
import ForceChangePassword from './pages/ForceChangePassword';

// 路由层强制改密守卫：当登录用户带 mustChangePassword=true 标志且
// 当前路径不在白名单（/force-change-password、/login）时，强制重定向到改密页，
// 并通过 state.from 记录原路径，用于改密成功后回跳。
function ForceChangeRouteGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  const whitelist = ['/force-change-password', '/login'];
  if (user?.mustChangePassword === true && !whitelist.includes(loc.pathname)) {
    return <Navigate to="/force-change-password" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ForceChangeRouteGuard>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/force-change-password" element={<ForceChangePassword />} />
        <Route path="/terminal/:id" element={<TerminalPage />} />
        <Route
          path="/admin/*"
          element={isAuthenticated ? <AdminLayout /> : <Navigate to="/login" />}
        >
          <Route index element={<Navigate to="resources" />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="users" element={user?.role === 'admin' ? <UsersPage /> : <Navigate to="/admin" />} />
          <Route path="settings" element={user?.role === 'admin' ? <SettingsPage /> : <Navigate to="/admin" />} />
          <Route path="smtp" element={user?.role === 'admin' ? <SmtpPage /> : <Navigate to="/admin" />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ForceChangeRouteGuard>
  );
}
