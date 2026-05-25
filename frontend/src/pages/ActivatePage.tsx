import { useState, useEffect } from 'react';
import { App, Button, Card, Form, Input, Result, Spin, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';

const { Title } = Typography;

export default function ActivatePage() {
  const { message: messageApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const token = searchParams.get('token') || '';
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    api.get('/auth/activate-check', { params: { token } })
      .then((res) => {
        setValid(res.data.valid);
        setUsername(res.data.username || '');
      })
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const onSubmit = async (values: { password: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/activate', { token, password: values.password });
      setActivated(true);
      messageApi.success('账号激活成功');
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '激活失败');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  if (!token || !valid) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <Result
            status="error"
            title="激活链接无效"
            subTitle="该激活链接无效或已过期，请联系管理员重新发送激活邮件。"
            extra={<Button type="primary" onClick={() => nav('/login')}>返回登录</Button>}
          />
        </Card>
      </div>
    );
  }

  if (activated) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <Result
            status="success"
            title="账号激活成功"
            subTitle="您的账号已激活，现在可以使用新密码登录。"
            extra={<Button type="primary" onClick={() => nav('/login')}>去登录</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <Title level={3} className="login-title">激活账号</Title>
        <Typography.Paragraph type="secondary" className="login-text-center">
          您好，<strong>{username}</strong>！请设置密码以完成账号激活。
        </Typography.Paragraph>
        <Form onFinish={onSubmit} size="large">
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: '密码需包含字母和数字' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="设置密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              激活账号
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
