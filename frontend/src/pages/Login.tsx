import { useState, useEffect } from 'react';
import { App, Button, Card, Form, Input, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';

const { Title, Text } = Typography;

export default function Login() {
  const { message: messageApi } = App.useApp();
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'mfa'>('login');
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [allowRegistration, setAllowRegistration] = useState(false);

  useEffect(() => {
    api.get('/system/settings/allow_registration')
      .then((res) => setAllowRegistration(res.data.allowRegistration))
      .catch(() => {});
  }, []);

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const result = await login(values.username, values.password);
      if (result?.mfaRequired) {
        setMode('mfa');
        setCredentials(values);
      } else {
        messageApi.success('登录成功');
        if (result?.user?.mustChangePassword) {
          nav('/force-change-password');
        } else {
          nav('/admin');
        }
      }
    } catch {
      messageApi.error('用户名或密码错误');
    }
    setLoading(false);
  };

  const onMfaSubmit = async (values: { mfaCode: string }) => {
    if (!credentials) return;
    setLoading(true);
    try {
      const result = await login(credentials.username, credentials.password, values.mfaCode);
      if (result?.mfaRequired) {
        messageApi.error('MFA 验证码错误');
      } else {
        messageApi.success('登录成功');
        if (result?.user?.mustChangePassword) {
          nav('/force-change-password');
        } else {
          nav('/admin');
        }
      }
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || 'MFA 验证失败');
    }
    setLoading(false);
  };

  const onRegister = async (values: { username: string; password: string; email?: string }) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.email);
      messageApi.success('注册成功');
      nav('/admin');
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '注册失败');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-corner-actions">
        <ThemeToggle />
      </div>
      <Card className="login-card">
        <Title level={3} className="login-title">
          {mode === 'register' ? 'Ops Dashboard 注册' : mode === 'mfa' ? '安全验证' : 'Ops Dashboard 管理登录'}
        </Title>
        {mode === 'login' && (
          <Form onFinish={onLogin} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
        )}
        {mode === 'mfa' && (
          <Form onFinish={onMfaSubmit} size="large">
            <div className="login-mfa-header">
              <div className="login-mfa-icon">
                <SafetyCertificateOutlined />
              </div>
              <Space direction="vertical" size={4} align="center">
                <Text strong className="login-mfa-title">两步验证</Text>
                <Text type="secondary" className="login-mfa-desc">
                  请输入身份验证器应用中的 6 位动态验证码
                </Text>
              </Space>
            </div>
            <Form.Item name="mfaCode" rules={[{ required: true, message: '请输入验证码' }]}>
              <Input
                prefix={<SafetyOutlined />}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="login-mfa-input"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                验证并登录
              </Button>
            </Form.Item>
            <div className="login-text-center">
              <Button type="link" onClick={() => { setMode('login'); setCredentials(null); }}>
                返回登录
              </Button>
            </div>
          </Form>
        )}
        {mode === 'register' && (
          <Form onFinish={onRegister} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item name="email">
              <Input prefix={<MailOutlined />} placeholder="邮箱（选填）" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                注册
              </Button>
            </Form.Item>
            <div className="login-text-center">
              <Button type="link" onClick={() => setMode('login')}>
                已有账号，去登录
              </Button>
            </div>
          </Form>
        )}
        <div className="login-text-center">
          {mode === 'login' && allowRegistration && (
            <Button type="link" onClick={() => setMode('register')}>
              没有账号？注册
            </Button>
          )}
          <Button type="link" onClick={() => nav('/')}>返回看板</Button>
        </div>
      </Card>
    </div>
  );
}
