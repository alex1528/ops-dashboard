import { useEffect, useState } from 'react';
import { Card, Col, Row, Tag, Typography, Spin, Badge, Progress, Button, Modal, Input, Space, message, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined, EyeOutlined, EyeInvisibleOutlined, DownloadOutlined, CodeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ResourceStatus } from '../types';
import { useAuth } from '../auth';
import api from '../api';
import SshTerminalModal from '../components/SshTerminalModal';

const { Title, Text } = Typography;

export default function StatusPage() {
  const [resources, setResources] = useState<ResourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');
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
  const { isAuthenticated } = useAuth();

  const load = async () => {
    try {
      const res = await fetch('/api/health/status');
      const data = await res.json();
      setResources(data);
      setLastRefresh(dayjs().format('HH:mm:ss'));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const viewCredential = async (id: string, name: string) => {
    const hide = message.loading('正在获取凭据…', 0);
    try {
      const res = await api.get(`/resources/${id}/credential`);
      hide();
      if (!res.data || res.data.exists === false) {
        message.info('未配置凭据');
        return;
      }
      setShowPrivateKey(false);
      setCredModal({
        open: true,
        title: `凭据信息 - ${name}`,
        resourceName: name,
        data: {
          username: res.data.username ?? '',
          password: res.data.password ?? '',
          extra: res.data.extra ?? '',
          privateKey: res.data.privateKey ?? '',
        },
      });
    } catch {
      hide();
      message.error('凭据获取失败，请确认已登录');
    }
  };

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

  const upCount = resources.filter(r => r.lastHealth?.status === 'up').length;
  const downCount = resources.filter(r => r.lastHealth?.status === 'down').length;
  const total = resources.length;

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
    if (s === 'up') return <CheckCircleOutlined className="status-icon status-icon--up" />;
    if (s === 'down') return <CloseCircleOutlined className="status-icon status-icon--down" />;
    return <QuestionCircleOutlined className="status-icon status-icon--unknown" />;
  };

  const msColor = (ms: number | null | undefined) => {
    if (ms == null) return undefined;
    if (ms < 200) return '#52c41a';
    if (ms < 1000) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div className="status-page">
      <div className="status-header">
        <div>
          <Title level={3} className="status-title">服务状态监控</Title>
          <Text className="status-subtitle">
            自动刷新 · 上次更新 {lastRefresh || '--:--:--'}
          </Text>
        </div>
        <div className="status-summary">
          {total > 0 && (
            <>
              <Badge status="success" text={<Text className="status-summary-text">{upCount} 正常</Text>} />
              {downCount > 0 && (
                <Badge status="error" text={<Text className="status-summary-text">{downCount} 异常</Text>} />
              )}
              {total - upCount - downCount > 0 && (
                <Badge status="default" text={<Text className="status-summary-text">{total - upCount - downCount} 未知</Text>} />
              )}
            </>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="status-bar-wrap">
          <Progress
            percent={100}
            success={{ percent: (upCount / total) * 100 }}
            strokeColor="#ff4d4f"
            showInfo={false}
            size="small"
          />
        </div>
      )}

      <Spin spinning={loading}>
        {sortedGroups.map(([group, items]) => (
          <div key={group} className="status-group">
            <Text strong className="status-group-label">
              {group === 'default' ? '未分组' : group}
            </Text>
            <Row gutter={[12, 12]}>
              {items.map(r => (
                <Col key={r.id} xs={24} sm={12} md={8} lg={6}>
                  <Card size="small" className="status-card" hoverable={false}>
                    <div className="status-card-top">
                      <Text strong className="status-card-name">{r.name}</Text>
                      {statusIcon(r.lastHealth?.status)}
                    </div>
                    <div className="status-card-meta">
                      <Badge
                        status={r.lastHealth?.status === 'up' ? 'success' : r.lastHealth?.status === 'down' ? 'error' : 'default'}
                        text={
                          <Text type="secondary" className="status-status-text">
                            {r.lastHealth?.skipped ? '免检·默认正常' : r.lastHealth?.status === 'up' ? '正常运行' : r.lastHealth?.status === 'down' ? '服务异常' : '状态未知'}
                          </Text>
                        }
                      />
                    </div>
                    <div className="status-card-stats">
                      {r.lastHealth?.responseMs != null && !r.lastHealth?.skipped && (
                        <Tag color={msColor(r.lastHealth.responseMs)} className="status-metric-tag">
                          {r.lastHealth.responseMs}ms
                        </Tag>
                      )}
                      {r.lastHealth?.statusCode != null && (
                        <Tag className="status-metric-tag">HTTP {r.lastHealth.statusCode}</Tag>
                      )}
                      {r.lastHealth?.checkedAt && (
                        <Text type="secondary" className="status-time">
                          {dayjs(r.lastHealth.checkedAt).format('HH:mm:ss')}
                        </Text>
                      )}
                    </div>
                    {r.description && (
                      <Text type="secondary" className="status-description">
                        {r.description}
                      </Text>
                    )}
                    {isAuthenticated && (
                      <div className="status-actions">
                        <Tooltip title="查看凭据">
                          <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => viewCredential(r.id, r.name)}
                            className="status-action-button"
                          />
                        </Tooltip>
                        {r.sshEnabled && (
                          <Tooltip title="SSH 终端">
                            <Button
                              type="link"
                              size="small"
                              icon={<CodeOutlined />}
                              onClick={() => setSshModal({ open: true, resourceId: r.id, resourceName: r.name, hasPrivateKey: !!r.hasPrivateKey })}
                              className="status-action-button"
                            />
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        {!loading && resources.length === 0 && (
          <div className="status-empty">
            <Text type="secondary">暂无监控资源</Text>
          </div>
        )}
      </Spin>

      <div className="status-footer">
        <Text type="secondary" className="status-footer-text">Ops Dashboard · 状态页 · 每 30 秒自动刷新</Text>
      </div>

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
          <Space direction="vertical" size="middle" className="status-cred-space">
            <div>
              <Text type="secondary">用户名：</Text>
              {credModal.data.username
                ? <Text strong copyable className="status-cred-copy">{credModal.data.username}</Text>
                : <Text type="secondary">（空）</Text>}
            </div>
            <div>
              <Text type="secondary">密码：</Text>
              {credModal.data.password
                ? <Text strong copyable className="status-cred-copy">{credModal.data.password}</Text>
                : <Text type="secondary">（空）</Text>}
            </div>
            {credModal.data.extra && (
              <div>
                <Text type="secondary">附加信息：</Text>
                <Text strong copyable className="status-cred-extra">{credModal.data.extra}</Text>
              </div>
            )}
            {credModal.data.privateKey && (
              <div>
                <div className="dash-cred-key-header">
                  <Text type="secondary">私钥（PEM）：</Text>
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
                    className="status-cred-privatekey"
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
