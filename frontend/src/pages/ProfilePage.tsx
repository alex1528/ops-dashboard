import { useEffect, useState } from 'react';
import {
  App, Card, Button, Typography, Input, Space, Tag, Modal, Form, Descriptions,
} from 'antd';
import { SafetyOutlined, MailOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text, Paragraph } = Typography;

export default function ProfilePage() {
  const { message: messageApi } = App.useApp();
  const [profile, setProfile] = useState<any>(null);
  const [mfaSetup, setMfaSetup] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disableForm] = Form.useForm();

  const loadProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data);
    } catch {
      messageApi.error('获取用户信息失败');
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSetupMfa = async () => {
    setLoading(true);
    try {
      const res = await api.post('/mfa/setup');
      setMfaSetup(res.data);
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || 'MFA 设置失败');
    }
    setLoading(false);
  };

  const handleVerifyMfa = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      messageApi.warning('请输入 6 位验证码');
      return;
    }
    setLoading(true);
    try {
      await api.post('/mfa/verify', { code: verifyCode });
      messageApi.success('MFA 绑定成功！');
      setMfaSetup(null);
      setVerifyCode('');
      loadProfile();
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '验证码错误');
    }
    setLoading(false);
  };

  const handleDisableMfa = async () => {
    const values = await disableForm.validateFields();
    setLoading(true);
    try {
      await api.post('/mfa/disable', { password: values.password });
      messageApi.success('MFA 已禁用');
      setDisableModalOpen(false);
      disableForm.resetFields();
      loadProfile();
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '操作失败');
    }
    setLoading(false);
  };

  if (!profile) return null;

  return (
    <div className="page-container">
      <Title level={4}>个人设置</Title>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户名">{profile.username}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color={profile.role === 'admin' ? 'red' : 'blue'}>
              {profile.role === 'admin' ? '管理员' : '普通用户'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            {profile.email || <Text type="secondary">未设置</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="MFA 状态">
            {profile.mfaEnabled
              ? <Tag color="green" icon={<SafetyOutlined />}>已启用</Tag>
              : <Tag>未启用</Tag>
            }
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<><SafetyOutlined /> MFA 两步验证</>} style={{ marginBottom: 24 }}>
        {profile.mfaEnabled ? (
          <div>
            <Paragraph>MFA 两步验证已启用，每次登录需输入动态验证码。</Paragraph>
            <Button danger onClick={() => setDisableModalOpen(true)}>禁用 MFA</Button>
          </div>
        ) : mfaSetup ? (
          <div>
            <Paragraph>请使用 Google Authenticator（或其他 TOTP 应用）扫描以下二维码：</Paragraph>
            <div className="mfa-qr-container">
              <img src={mfaSetup.qrDataUrl} alt="MFA QR Code" />
            </div>
            <Paragraph type="secondary">
              手动输入密钥：<Text code copyable>{mfaSetup.secret}</Text>
            </Paragraph>
            <Space style={{ marginTop: 16 }}>
              <Input
                placeholder="输入 6 位验证码"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                onPressEnter={handleVerifyMfa}
                style={{ width: 180 }}
              />
              <Button type="primary" loading={loading} onClick={handleVerifyMfa}>验证并启用</Button>
              <Button onClick={() => { setMfaSetup(null); setVerifyCode(''); }}>取消</Button>
            </Space>
          </div>
        ) : (
          <div>
            <Paragraph>启用 MFA 后，登录时需要额外输入动态验证码，提升账户安全性。</Paragraph>
            <Paragraph type="secondary">支持 Google Authenticator、Microsoft Authenticator 等 TOTP 应用。</Paragraph>
            <Button type="primary" icon={<SafetyOutlined />} loading={loading} onClick={handleSetupMfa}>
              设置 MFA
            </Button>
          </div>
        )}
      </Card>

      <Modal
        title="禁用 MFA"
        open={disableModalOpen}
        onOk={handleDisableMfa}
        onCancel={() => { setDisableModalOpen(false); disableForm.resetFields(); }}
        confirmLoading={loading}
      >
        <Paragraph>禁用 MFA 后登录将不再要求动态验证码。请输入当前密码确认操作：</Paragraph>
        <Form form={disableForm} layout="vertical">
          <Form.Item name="password" label="当前密码" rules={[{ required: true }]}>
            <Input.Password placeholder="输入当前登录密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
