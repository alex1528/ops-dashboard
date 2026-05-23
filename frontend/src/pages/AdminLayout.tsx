import { Layout, Menu, Button, Typography, Tag } from 'antd';
import {
  DashboardOutlined, AppstoreOutlined, LogoutOutlined,
  TeamOutlined, UserOutlined, MailOutlined, InfoCircleOutlined, SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const { Header, Content, Sider } = Layout;

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout, user } = useAuth();

  const isAdmin = user?.role === 'admin';

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '状态看板', onClick: () => nav('/') },
    { key: '/admin/resources', icon: <AppstoreOutlined />, label: '资源管理', onClick: () => nav('/admin/resources') },
    ...(isAdmin ? [
      { key: '/admin/users', icon: <TeamOutlined />, label: '用户管理', onClick: () => nav('/admin/users') },
      { key: '/admin/settings', icon: <SettingOutlined />, label: '系统设置', onClick: () => nav('/admin/settings') },
      { key: '/admin/smtp', icon: <MailOutlined />, label: '邮件设置', onClick: () => nav('/admin/smtp') },
    ] : []),
    { key: '/admin/profile', icon: <UserOutlined />, label: '个人设置', onClick: () => nav('/admin/profile') },
    { key: '/admin/about', icon: <InfoCircleOutlined />, label: '关于', onClick: () => nav('/admin/about') },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div className="sider-title">
          Ops Dashboard
        </div>
        <Menu
          theme="dark"
          selectedKeys={[loc.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          {user && (
            <Typography.Text type="secondary" className="admin-header-user">
              <span className="admin-header-username">{user.username}</span>
              <Tag color={user.role === 'admin' ? 'red' : 'blue'} className="admin-header-role-tag">
                {user.role === 'admin' ? '管理员' : '用户'}
              </Tag>
            </Typography.Text>
          )}
          <Button icon={<LogoutOutlined />} onClick={() => { logout(); nav('/login'); }}>退出</Button>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
