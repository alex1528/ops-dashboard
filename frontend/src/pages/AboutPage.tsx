import { useEffect, useState } from 'react';
import { Card, Typography, Descriptions, Tag, Spin, Space } from 'antd';
import { InfoCircleOutlined, GithubOutlined, TagOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text, Link } = Typography;

export default function AboutPage() {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/system/version')
      .then((res) => setVersion(res.data.version))
      .catch(() => setVersion('unknown'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container-sm">
      <Title level={4}><InfoCircleOutlined /> 关于系统</Title>

      <Card style={{ marginBottom: 24 }}>
        <div className="about-header-body">
          <Title level={2} style={{ margin: 0 }}>🖥 Ops Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 14, display: 'block', marginTop: 8 }}>
            运维统一入口看板
          </Text>
          <div className="about-version-tag">
            {loading ? (
              <Spin size="small" />
            ) : (
              <Tag icon={<TagOutlined />} color="blue" style={{ fontSize: 16, padding: '4px 16px' }}>
                {version}
              </Tag>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="系统名称">Ops Dashboard</Descriptions.Item>
          <Descriptions.Item label="系统版本">
            <Space>
              {loading ? <Spin size="small" /> : <Text strong>{version}</Text>}
              <Text type="secondary">(git tag)</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="技术栈">
            <Space wrap>
              <Tag color="blue">React 19</Tag>
              <Tag color="blue">Ant Design 5</Tag>
              <Tag color="green">NestJS</Tag>
              <Tag color="green">Prisma</Tag>
              <Tag>SQLite</Tag>
              <Tag color="cyan">Docker</Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="功能模块">
            <Space wrap>
              <Tag>状态监控</Tag>
              <Tag>资源管理</Tag>
              <Tag>凭据加密</Tag>
              <Tag>用户管理</Tag>
              <Tag>MFA 两步验证</Tag>
              <Tag>邮件通知</Tag>
              <Tag>自动登录代理</Tag>
              <Tag>数据库备份</Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="项目地址">
            <Link href="https://github.com/alex1528/ops-dashboard" target="_blank">
              <GithubOutlined /> alex1528/ops-dashboard
            </Link>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
