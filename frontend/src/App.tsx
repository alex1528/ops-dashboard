import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './auth';
import Dashboard from './pages/Dashboard';
import StatusPage from './pages/StatusPage';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import ResourcesPage from './pages/ResourcesPage';

export default function App() {
  const { isAuthenticated, isInitializing } = useAuth();

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
      <Route
        path="/admin/*"
        element={isAuthenticated ? <AdminLayout /> : <Navigate to="/login" />}
      >
        <Route index element={<Navigate to="resources" />} />
        <Route path="resources" element={<ResourcesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
