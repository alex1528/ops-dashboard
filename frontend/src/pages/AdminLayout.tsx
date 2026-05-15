import { Layout, Menu, Button, Typography } from 'antd';
import { DashboardOutlined, AppstoreOutlined, LogoutOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const { Header, Content, Sider } = Layout;

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout } = useAuth();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: '#fff', padding: '16px', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
          Ops Dashboard
        </div>
        <Menu
          theme="dark"
          selectedKeys={[loc.pathname]}
          items={[
            { key: '/', icon: <DashboardOutlined />, label: '状态看板', onClick: () => nav('/') },
            { key: '/admin/resources', icon: <AppstoreOutlined />, label: '资源管理', onClick: () => nav('/admin/resources') },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button icon={<LogoutOutlined />} onClick={() => { logout(); nav('/login'); }}>退出</Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
