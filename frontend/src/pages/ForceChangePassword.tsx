import { useState } from 'react';
import { App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import api from '../api';

const { Title } = Typography;

interface FormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface LocationState {
  from?: string;
}

// 与后端 assertPasswordStrength 等价的前端强度策略：
// - 长度至少 8
// - 同时包含字母和数字
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export default function ForceChangePassword() {
  const { message: messageApi } = App.useApp();
  const { markPasswordChanged, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);

  const redirectTo = (loc.state as LocationState | null)?.from;

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      markPasswordChanged();
      messageApi.success('密码修改成功');
      nav(redirectTo ?? '/', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '密码修改失败，请稍后重试';
      messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onLogout = () => {
    logout();
    nav('/login');
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <Title level={3} className="login-title">
          首次登录请修改密码
        </Title>
        <Form<FormValues>
          form={form}
          onFinish={onSubmit}
          size="large"
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="原密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            dependencies={['oldPassword']}
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少 8 位且需同时包含字母和数字' },
              {
                pattern: PASSWORD_PATTERN,
                message: '密码至少 8 位且需同时包含字母和数字',
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  if (value === getFieldValue('oldPassword')) {
                    return Promise.reject(new Error('新密码不能与原密码相同'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="新密码（至少 8 位，含字母与数字）"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  if (value !== getFieldValue('newPassword')) {
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                提交
              </Button>
              <Button onClick={onLogout} disabled={loading} block>
                退出登录
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
