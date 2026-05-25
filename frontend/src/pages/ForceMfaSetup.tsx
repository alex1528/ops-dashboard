import { useState } from 'react';
import { App, Button, Card, Input, Space, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import ThemeToggle from '../components/ThemeToggle';

const { Title, Text, Paragraph } = Typography;

export default function ForceMfaSetup() {
  const { message: messageApi } = App.useApp();
  const { markMfaSetupComplete } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = (loc.state as any)?.from || '/';

  const [mfaSetup, setMfaSetup] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await api.post('/mfa/setup');
      setMfaSetup(res.data);
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || 'MFA 设置失败');
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      messageApi.warning('请输入 6 位验证码');
      return;
    }
    setLoading(true);
    try {
      await api.post('/mfa/verify', { code: verifyCode });
      messageApi.success('MFA 绑定成功！');
      markMfaSetupComplete();
      nav(redirectTo, { replace: true });
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '验证码错误');
    }
    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      <Card className="login-card" styles={{ body: { padding: '32px 24px' } }}>
        <div className="login-mfa-header">
          <div className="login-mfa-icon">
            <SafetyCertificateOutlined />
          </div>
          <Title level={4} style={{ marginBottom: 4 }}>绑定 MFA 两步验证</Title>
          <Text type="secondary">为确保账户安全，请先完成 MFA 两步验证绑定</Text>
        </div>

        {!mfaSetup ? (
          <div className="login-text-center">
            <Paragraph>
              您需要使用 Google Authenticator 或其他 TOTP 应用完成 MFA 绑定后才能继续使用系统。
            </Paragraph>
            <Button type="primary" size="large" icon={<SafetyCertificateOutlined />} loading={loading} onClick={handleSetup}>
              开始设置 MFA
            </Button>
          </div>
        ) : (
          <div>
            <Paragraph>请使用 Google Authenticator（或其他 TOTP 应用）扫描以下二维码：</Paragraph>
            <div className="mfa-qr-container login-text-center">
              <img src={mfaSetup.qrDataUrl} alt="MFA QR Code" />
            </div>
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              手动输入密钥：<Text code copyable>{mfaSetup.secret}</Text>
            </Paragraph>
            <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} align="center">
              <Input
                placeholder="输入 6 位验证码"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                onPressEnter={handleVerify}
                className="login-mfa-input"
                style={{ width: 200 }}
              />
              <Button type="primary" block loading={loading} onClick={handleVerify} style={{ maxWidth: 200 }}>
                验证并启用
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
