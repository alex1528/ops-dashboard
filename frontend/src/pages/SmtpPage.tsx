import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Card, Descriptions, Form, Input, Space, Tag, Typography,
} from 'antd';
import { MailOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Paragraph, Text } = Typography;

export default function SmtpPage() {
  const { message: messageApi } = App.useApp();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/mail/status');
      setStatus(res.data);
    } catch {
      messageApi.error('获取 SMTP 状态失败');
    }
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const handleTestSend = async () => {
    const values = await form.validateFields();
    setTestLoading(true);
    try {
      const res = await api.post('/mail/test', { to: values.testEmail });
      if (res.data.sent) {
        messageApi.success('测试邮件已发送，请检查收件箱');
      } else {
        messageApi.error(`发送失败：${res.data.reason}`);
      }
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '发送失败');
    }
    setTestLoading(false);
  };

  return (
    <div className="page-container">
      <Title level={4}>邮件设置 (SMTP)</Title>

      <Card loading={loading} style={{ marginBottom: 24 }}>
        <Descriptions column={1} bordered size="small" title="当前配置状态">
          <Descriptions.Item label="状态">
            {status?.configured
              ? <Tag icon={<CheckCircleOutlined />} color="success">已配置</Tag>
              : <Tag icon={<CloseCircleOutlined />} color="default">未配置</Tag>
            }
          </Descriptions.Item>
          {status?.configured && (
            <>
              <Descriptions.Item label="SMTP 服务器">{status.host}:{status.port}</Descriptions.Item>
              <Descriptions.Item label="认证账号">{status.user}</Descriptions.Item>
              <Descriptions.Item label="发件人">{status.from}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {!status?.configured && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
          message="SMTP 未配置"
          description={
            <div>
              <Paragraph style={{ margin: 0 }}>
                请在服务器环境变量或 <Text code>.env</Text> 文件中配置以下变量后重启服务：
              </Paragraph>
              <pre className="smtp-env-block">
{`SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=ops@example.com
SMTP_PASS=your-password
SMTP_FROM=ops@example.com`}
              </pre>
            </div>
          }
        />
      )}

      {status?.configured && (
        <Card title={<><MailOutlined /> 发送测试邮件</>}>
          <Form form={form} layout="inline" onFinish={handleTestSend}>
            <Form.Item
              name="testEmail"
              rules={[
                { required: true, message: '请输入收件地址' },
                { type: 'email', message: '请输入有效邮箱' },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="test@example.com" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={testLoading} icon={<MailOutlined />}>
                发送测试
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}
