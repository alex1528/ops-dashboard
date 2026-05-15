import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const { Title } = Typography;

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const result = await login(values.username, values.password);
      if (result?.mfaRequired) {
        setMfaRequired(true);
        setCredentials(values);
        message.info('请输入 MFA 验证码');
      } else {
        message.success('登录成功');
        nav('/admin');
      }
    } catch {
      message.error('用户名或密码错误');
    }
    setLoading(false);
  };

  const onMfaSubmit = async (values: { mfaCode: string }) => {
    if (!credentials) return;
    setLoading(true);
    try {
      const result = await login(credentials.username, credentials.password, values.mfaCode);
      if (result?.mfaRequired) {
        message.error('MFA 验证码错误');
      } else {
        message.success('登录成功');
        nav('/admin');
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'MFA 验证失败');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <Card style={{ width: 380 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
          Ops Dashboard 管理登录
        </Title>
        {!mfaRequired ? (
          <Form onFinish={onFinish} size="large">
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
        ) : (
          <Form onFinish={onMfaSubmit} size="large">
            <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
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
              <Button type="link" onClick={() => { setMfaRequired(false); setCredentials(null); }}>
                返回登录
              </Button>
            </div>
          </Form>
        )}
        <div className="login-text-center">
          <Button type="link" onClick={() => nav('/')}>返回看板</Button>
        </div>
      </Card>
    </div>
  );
}
