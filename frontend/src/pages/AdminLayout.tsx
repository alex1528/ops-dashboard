import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Typography, Tag } from 'antd';
import {
  DashboardOutlined, AppstoreOutlined, LogoutOutlined,
  TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import api from '../api';

const { Header, Content, Sider } = Layout;

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout, user } = useAuth();
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.get('/system/version').then((res) => setVersion(res.data.version)).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '状态看板', onClick: () => nav('/') },
    { key: '/admin/resources', icon: <AppstoreOutlined />, label: '资源管理', onClick: () => nav('/admin/resources') },
    ...(isAdmin ? [
      { key: '/admin/users', icon: <TeamOutlined />, label: '用户管理', onClick: () => nav('/admin/users') },
    ] : []),
    { key: '/admin/profile', icon: <UserOutlined />, label: '个人设置', onClick: () => nav('/admin/profile') },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: '#fff', padding: '16px', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
          Ops Dashboard
          {version && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{version}</Tag>}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[loc.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {user && (
            <Typography.Text type="secondary">
              {user.username}
              <Tag color={user.role === 'admin' ? 'red' : 'blue'} style={{ marginLeft: 8 }}>
                {user.role === 'admin' ? '管理员' : '用户'}
              </Tag>
            </Typography.Text>
          )}
          <Button icon={<LogoutOutlined />} onClick={() => { logout(); nav('/login'); }}>退出</Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
