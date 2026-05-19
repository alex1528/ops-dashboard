import { useEffect, useState } from 'react';
import { App, Badge, Button, Card, Col, Modal, Row, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  ReloadOutlined, SettingOutlined, LinkOutlined, LoginOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';
import { useAuth } from '../auth';
import type { ResourceStatus } from '../types';

const { Title, Text, Paragraph } = Typography;

export default function Dashboard() {
  const { message: messageApi, modal } = App.useApp();
  const [resources, setResources] = useState<ResourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [credLoading, setCredLoading] = useState<string | null>(null);
  const nav = useNavigate();
  const { isAuthenticated } = useAuth();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/health/status');
      setResources(res.data);
    } catch {
      messageApi.error('加载状态失败，请检查网络连接');
    }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  /**
   * Smart launch: uses proxy auto-login for authenticated users,
   * falls back to direct link for unauthenticated or link-mode resources.
   */
  const handleLaunch = async (r: ResourceStatus) => {
    // If not logged in or resource is link mode, just open directly
    if (!isAuthenticated || r.loginMode === 'link') {
      window.open(r.url, '_blank', 'noopener');
      return;
    }

    setLaunching(r.id);
    try {
      const res = await api.get(`/proxy/${r.id}/launch`);
      const data = res.data;

      if (data.mode === 'auto' && data.proxyUrl) {
        // Open the proxied URL — the backend injects auth into all requests
        window.open(data.proxyUrl, '_blank', 'noopener');
      } else if (data.mode === 'semi-auto') {
        // Show pre-filled credentials for manual login
        showSemiAutoModal(r, data);
      } else {
        // Fallback: open direct link
        window.open(data.targetUrl || r.url, '_blank', 'noopener');
        if (data.error) messageApi.warning(data.error);
      }
    } catch {
      // API failed, fallback to direct link
      window.open(r.url, '_blank', 'noopener');
    }
    setLaunching(null);
  };

  /** Show modal with pre-filled credentials for captcha systems */
  const showSemiAutoModal = (r: ResourceStatus, data: any) => {
    const prefill = data.prefill;
    modal.info({
      title: `半自动登录: ${r.name}`,
      width: 500,
      content: (
        <div>
          <Paragraph>该系统需要验证码，已为您准备好登录凭据：</Paragraph>
          {prefill && (
            <div className="semi-auto-prefill">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">用户名：</Text>
                  <Text strong copyable>{prefill.username}</Text>
                </div>
                <div>
                  <Text type="secondary">密码：</Text>
                  <Text strong copyable>{prefill.password}</Text>
                </div>
              </Space>
            </div>
          )}
          <Paragraph type="secondary">
            点击确定后将打开目标系统登录页，请粘贴凭据并手动输入验证码。
          </Paragraph>
        </div>
      ),
      onOk: () => window.open(r.url, '_blank', 'noopener'),
      okText: '打开登录页',
    });
  };

  /** View credential for a resource (requires login) */
  const handleViewCredential = async (e: React.MouseEvent, r: ResourceStatus) => {
    e.stopPropagation(); // 阻止冒泡，避免触发卡片点击（一键直达）
    setCredLoading(r.id);
    try {
      const res = await api.get(`/resources/${r.id}/credential`);
      const data = res.data;
      if (!data || data.exists === false) {
        messageApi.info('该资源未配置凭据');
        return;
      }
      modal.info({
        title: `凭据信息 — ${r.name}`,
        width: 480,
        content: (
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
            <div>
              <Text type="secondary">用户名：</Text>
              {data.username
                ? <Text strong copyable style={{ wordBreak: 'break-all' }}>{data.username}</Text>
                : <Text type="secondary">（空）</Text>}
            </div>
            <div>
              <Text type="secondary">密码：</Text>
              {data.password
                ? <Text strong copyable style={{ wordBreak: 'break-all' }}>{data.password}</Text>
                : <Text type="secondary">（空）</Text>}
            </div>
            {data.extra && (
              <div>
                <Text type="secondary">附加信息：</Text>
                <Text strong copyable style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{data.extra}</Text>
              </div>
            )}
          </Space>
        ),
        okText: '关闭',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || '凭据获取失败，请确认已登录';
      messageApi.error(msg);
    } finally {
      setCredLoading(null);
    }
  };

  const grouped = resources.reduce<Record<string, ResourceStatus[]>>((acc, r) => {
    (acc[r.group] = acc[r.group] || []).push(r);
    return acc;
  }, {});

  // 按 groupSortOrder 排序分组，组内按 sortOrder 排序
  const sortedGroups = Object.entries(grouped)
    .sort(([, a], [, b]) => {
      const aOrder = a[0]?.groupSortOrder ?? 0;
      const bOrder = b[0]?.groupSortOrder ?? 0;
      return aOrder - bOrder;
    })
    .map(([group, items]) => [
      group,
      [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    ] as [string, ResourceStatus[]]);

  const statusIcon = (s?: string) => {
    if (s === 'up') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
    if (s === 'down') return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />;
    return <QuestionCircleOutlined style={{ color: '#d9d9d9', fontSize: 24 }} />;
  };

  const statusColor = (s?: string) => (s === 'up' ? 'success' : s === 'down' ? 'error' : 'default');

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <Title level={2} style={{ margin: 0 }}>🖥 运维总览</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button icon={<SettingOutlined />} onClick={() => nav('/admin')}>管理</Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {sortedGroups.map(([group, items]) => (
          <div key={group} className="dashboard-group">
            <Title level={4} className="dashboard-group-title">
              {group === 'default' ? '未分组' : group}
            </Title>
            <Row gutter={[16, 16]}>
              {items.map((r) => (
                <Col key={r.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    loading={launching === r.id}
                    onClick={() => handleLaunch(r)}
                    styles={{ body: { padding: 16 } }}
                  >
                    <div className="dashboard-card-top">
                      <div className="dashboard-card-info">
                        <Text strong className="dashboard-card-name">
                          {r.name}
                        </Text>
                        <Text type="secondary" className="dashboard-card-url">
                          {r.url}
                        </Text>
                      </div>
                      {statusIcon(r.lastHealth?.status)}
                    </div>
                    <div className="dashboard-card-stats">
                      <Badge
                        status={statusColor(r.lastHealth?.status) as any}
                        text={
                          r.lastHealth?.skipped ? '免检' :
                          r.lastHealth?.status === 'up' ? '正常' :
                          r.lastHealth?.status === 'down' ? '异常' : '未知'
                        }
                      />
                      {r.lastHealth?.responseMs != null && !r.lastHealth?.skipped && (
                        <Tag>{r.lastHealth.responseMs}ms</Tag>
                      )}
                      {r.lastHealth?.checkedAt && (
                        <Text type="secondary" className="dashboard-card-time">
                          {dayjs(r.lastHealth.checkedAt).format('HH:mm:ss')}
                        </Text>
                      )}
                    </div>
                    {r.description && (
                      <Text type="secondary" className="dashboard-card-desc">
                        {r.description}
                      </Text>
                    )}
                    <div className="dashboard-card-footer">
                      <Tag
                        color={r.loginMode === 'auto' ? 'green' : r.loginMode === 'semi-auto' ? 'orange' : 'blue'}
                        className="dashboard-card-mode"
                      >
                        {r.loginMode === 'auto' ? '自动登录' : r.loginMode === 'semi-auto' ? '半自动' : '外链'}
                      </Tag>
                      <Space size={4}>
                        {isAuthenticated && (
                          <Tooltip title="查看凭据">
                            <Button
                              size="small"
                              type="text"
                              icon={<EyeOutlined />}
                              loading={credLoading === r.id}
                              onClick={(e) => handleViewCredential(e, r)}
                              style={{ color: '#8c8c8c' }}
                            />
                          </Tooltip>
                        )}
                        <Tooltip title={r.loginMode === 'auto' ? '一键直达' : r.loginMode === 'semi-auto' ? '辅助登录' : '新标签页打开'}>
                          {r.loginMode === 'link'
                            ? <LinkOutlined style={{ color: '#1890ff' }} />
                            : <LoginOutlined style={{ color: r.loginMode === 'auto' ? '#52c41a' : '#faad14' }} />
                          }
                        </Tooltip>
                      </Space>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        {!loading && resources.length === 0 && (
          <div className="dashboard-empty">
            <Text type="secondary">暂无目标资源，请先进入管理后台添加。</Text>
          </div>
        )}
      </Spin>
    </div>
  );
}
