import { useState, useEffect } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import api from '../api';

const { Title } = Typography;

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
        messageApi.info('请输入 MFA 验证码');
      } else {
        messageApi.success('登录成功');
        nav('/admin');
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
        nav('/admin');
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
      <Card className="login-card">
        <Title level={3} className="login-title">
          {mode === 'register' ? 'Ops Dashboard 注册' : 'Ops Dashboard 管理登录'}
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
            <Typography.Paragraph type="secondary" className="login-text-center">
              请输入 MFA 动态验证码
            </Typography.Paragraph>
            <Form.Item name="mfaCode" rules={[{ required: true, message: '请输入验证码' }]}>
              <Input
                prefix={<SafetyOutlined />}
                placeholder="6 位验证码"
                maxLength={6}
                autoFocus
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                验证
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
