import { useEffect, useState } from 'react';
import { App, Badge, Button, Card, Col, Input, Modal, Row, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  ReloadOutlined, SettingOutlined, LinkOutlined, EyeOutlined, EyeInvisibleOutlined, DownloadOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';
import { useAuth } from '../auth';
import type { ResourceStatus } from '../types';
import SshTerminalModal from '../components/SshTerminalModal';
import CopyButton from '../components/CopyButton';
import ThemeToggle from '../components/ThemeToggle';

const { Title, Text } = Typography;

export default function Dashboard() {
  const { message: messageApi } = App.useApp();
  const [resources, setResources] = useState<ResourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [credLoading, setCredLoading] = useState<string | null>(null);
  const [credModal, setCredModal] = useState<{
    open: boolean;
    title: string;
    resourceName: string;
    data: { username: string; password: string; extra: string; privateKey: string } | null;
  }>({ open: false, title: '', resourceName: '', data: null });
  const [sshModal, setSshModal] = useState<{
    open: boolean;
    resourceId: string;
    resourceName: string;
    hasPrivateKey: boolean;
  }>({ open: false, resourceId: '', resourceName: '', hasPrivateKey: false });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const nav = useNavigate();
  const { isAuthenticated, hasResourceAccess, user } = useAuth();

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
   * Open resource link in new tab.
   */
  const handleLaunch = (r: ResourceStatus) => {
    window.open(r.url, '_blank', 'noopener');
  };

  /** 显式的「打开链接」按钮点击处理：阻止冒泡，避免影响卡片其它交互 */
  const handleLaunchClick = (e: React.MouseEvent, r: ResourceStatus) => {
    e.stopPropagation();
    e.preventDefault();
    void handleLaunch(r);
  };

  /** View credential for a resource (requires login) */
  const handleViewCredential = async (e: React.MouseEvent, r: ResourceStatus) => {
    e.stopPropagation();
    setCredLoading(r.id);
    try {
      const res = await api.get(`/resources/${r.id}/credential`);
      const data = res.data;
      if (!data || data.exists === false) {
        messageApi.info('该资源未配置凭据');
        return;
      }
      setShowPrivateKey(false);
      setCredModal({
        open: true,
        title: `凭据信息 — ${r.name}`,
        resourceName: r.name,
        data: {
          username: data.username ?? '',
          password: data.password ?? '',
          extra: data.extra ?? '',
          privateKey: data.privateKey ?? '',
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || '凭据获取失败，请确认已登录';
      messageApi.error(msg);
    } finally {
      setCredLoading(null);
    }
  };

  /** 下载私钥为 .pem 文件 */
  const downloadPrivateKey = (content: string, resourceName: string) => {
    const blob = new Blob([content], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = resourceName.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    a.download = `${safeName}_private_key.pem`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Open SSH terminal for a resource */
  const handleSshConnect = (e: React.MouseEvent, r: ResourceStatus) => {
    e.stopPropagation();
    setSshModal({
      open: true,
      resourceId: r.id,
      resourceName: r.name,
      hasPrivateKey: !!r.hasPrivateKey,
    });
  };

  const grouped = resources
    .filter((r) => !isAuthenticated || user?.role === 'admin' || hasResourceAccess(r.id, r.group, r.ownerId))
    .reduce<Record<string, ResourceStatus[]>>((acc, r) => {
      const key = r.subGroup ? `${r.group} / ${r.subGroup}` : `${r.group} / 全部`;
      (acc[key] = acc[key] || []).push(r);
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
          <ThemeToggle />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button icon={<SettingOutlined />} onClick={() => nav('/admin')}>管理</Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {sortedGroups.map(([group, items]) => (
          <div key={group} className="dashboard-group">
            <Title level={4} className="dashboard-group-title">
              {group === 'default / 全部' ? '未分组' : group}
            </Title>
            <Row gutter={[16, 16]}>
              {items.map((r) => (
                <Col key={r.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
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
                      <Space size={4}>
                        <CopyButton text={r.url} />
                        {isAuthenticated && r.hasCredential && (
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
                        {isAuthenticated && r.sshEnabled && (
                          <Tooltip title="SSH 终端">
                            <Button
                              size="small"
                              type="text"
                              icon={<CodeOutlined />}
                              onClick={(e) => handleSshConnect(e, r)}
                              style={{ color: '#8c8c8c' }}
                            />
                          </Tooltip>
                        )}
                        <Tooltip title="在新标签页打开">
                          <Button
                            size="small"
                            type="text"
                            icon={<LinkOutlined style={{ color: '#1890ff' }} />}
                            aria-label="在新标签页打开"
                            onClick={(e) => handleLaunchClick(e, r)}
                          />
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

      {/* 凭据查看弹窗（受控，支持私钥下载） */}
      <Modal
        title={credModal.title}
        open={credModal.open}
        onCancel={() => setCredModal((s) => ({ ...s, open: false }))}
        destroyOnClose
        footer={[
          credModal.data?.privateKey ? (
            <Button
              key="download"
              icon={<DownloadOutlined />}
              onClick={() => downloadPrivateKey(credModal.data!.privateKey, credModal.resourceName)}
            >
              下载私钥 (.pem)
            </Button>
          ) : null,
          <Button key="close" onClick={() => setCredModal((s) => ({ ...s, open: false }))}>关闭</Button>,
        ]}
        width={520}
      >
        {credModal.data && (
          <Space direction="vertical" size="middle" className="dash-cred-space">
            <div>
              <Text type="secondary">用户名：</Text>
              {credModal.data.username
                ? <Text strong copyable className="dash-cred-copy">{credModal.data.username}</Text>
                : <Text type="secondary">（空）</Text>}
            </div>
            <div>
              <Text type="secondary">密码：</Text>
              {credModal.data.password
                ? <Text strong copyable className="dash-cred-copy">{credModal.data.password}</Text>
                : <Text type="secondary">（空）</Text>}
            </div>
            {credModal.data.extra && (
              <div>
                <Text type="secondary">附加信息：</Text>
                <Text strong copyable className="dash-cred-extra">{credModal.data.extra}</Text>
              </div>
            )}
            {credModal.data.privateKey && (
              <div>
                <div className="dash-cred-key-header">
                  <Text type="secondary">私钥(PEM)：</Text>
                  <Button
                    size="small"
                    type="link"
                    icon={showPrivateKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowPrivateKey((v) => !v)}
                    className="dash-cred-key-toggle"
                  >
                    {showPrivateKey ? '隐藏' : '显示'}
                  </Button>
                </div>
                {showPrivateKey && (
                  <Input.TextArea
                    value={credModal.data.privateKey}
                    readOnly
                    rows={6}
                    className="dash-cred-privatekey"
                  />
                )}
              </div>
            )}
          </Space>
        )}
      </Modal>

      {/* SSH 终端弹窗 */}
      <SshTerminalModal
        open={sshModal.open}
        resourceId={sshModal.resourceId}
        resourceName={sshModal.resourceName}
        hasPrivateKey={sshModal.hasPrivateKey}
        onClose={() => setSshModal((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
