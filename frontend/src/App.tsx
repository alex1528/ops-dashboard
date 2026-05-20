import { Routes, Route, Navigate } from 'react-router-dom';
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
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/login" element={<Login />} />
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
  );
}
