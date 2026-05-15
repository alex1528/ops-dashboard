import { useEffect, useState } from 'react';
import { Card, Col, Row, Tag, Typography, Spin, Badge, Progress } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ResourceStatus } from '../types';

const { Title, Text } = Typography;

export default function StatusPage() {
  const [resources, setResources] = useState<ResourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

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

  const upCount = resources.filter(r => r.lastHealth?.status === 'up').length;
  const downCount = resources.filter(r => r.lastHealth?.status === 'down').length;
  const total = resources.length;

  const grouped = resources.reduce<Record<string, ResourceStatus[]>>((acc, r) => {
    (acc[r.group] = acc[r.group] || []).push(r);
    return acc;
  }, {});

  const statusIcon = (s?: string) => {
    if (s === 'up') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
    if (s === 'down') return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
    return <QuestionCircleOutlined style={{ color: '#d9d9d9', fontSize: 20 }} />;
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
          <Title level={3} style={{ margin: 0, color: '#fff' }}>服务状态监控</Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            自动刷新 · 上次更新 {lastRefresh || '--:--:--'}
          </Text>
        </div>
        <div className="status-summary">
          {total > 0 && (
            <>
              <Badge status="success" text={<Text style={{ color: '#fff' }}>{upCount} 正常</Text>} />
              {downCount > 0 && (
                <Badge status="error" text={<Text style={{ color: '#fff' }}>{downCount} 异常</Text>} />
              )}
              {total - upCount - downCount > 0 && (
                <Badge status="default" text={<Text style={{ color: '#fff' }}>{total - upCount - downCount} 未知</Text>} />
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
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="status-group">
            <Text strong style={{ fontSize: 14, color: '#666', display: 'block', marginBottom: 8 }}>
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
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {r.lastHealth?.skipped ? '免检·默认正常' : r.lastHealth?.status === 'up' ? '正常运行' : r.lastHealth?.status === 'down' ? '服务异常' : '状态未知'}
                          </Text>
                        }
                      />
                    </div>
                    <div className="status-card-stats">
                      {r.lastHealth?.responseMs != null && !r.lastHealth?.skipped && (
                        <Tag color={msColor(r.lastHealth.responseMs)} style={{ borderRadius: 10 }}>
                          {r.lastHealth.responseMs}ms
                        </Tag>
                      )}
                      {r.lastHealth?.statusCode != null && (
                        <Tag style={{ borderRadius: 10 }}>HTTP {r.lastHealth.statusCode}</Tag>
                      )}
                      {r.lastHealth?.checkedAt && (
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                          {dayjs(r.lastHealth.checkedAt).format('HH:mm:ss')}
                        </Text>
                      )}
                    </div>
                    {r.description && (
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                        {r.description}
                      </Text>
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
        <Text type="secondary" style={{ fontSize: 12 }}>Ops Dashboard · 只读状态页 · 每 30 秒自动刷新</Text>
      </div>
    </div>
  );
}
