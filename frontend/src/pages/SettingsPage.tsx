import { useEffect, useState } from 'react';
import { App, Card, Switch, Typography, Descriptions } from 'antd';
import api from '../api';

const { Title } = Typography;

export default function SettingsPage() {
  const { message: messageApi } = App.useApp();
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/system/settings/allow_registration')
      .then((res) => setAllowRegistration(res.data.allowRegistration))
      .catch(() => messageApi.error('加载设置失败'));
  }, []);

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      const res = await api.put('/system/settings/allow_registration', { allowRegistration: checked });
      setAllowRegistration(res.data.allowRegistration);
      messageApi.success(checked ? '已开放注册' : '已关闭注册');
    } catch {
      messageApi.error('设置保存失败');
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <Title level={4}>系统设置</Title>
      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="允许公开注册">
            <Switch
              checked={allowRegistration}
              onChange={handleToggle}
              loading={loading}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
            <Typography.Text type="secondary" className="settings-hint">
              开启后，任何人可通过登录页注册新账号（默认为普通用户角色）
            </Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
