import { useEffect, useState } from 'react';
import {
  App, Table, Button, Modal, Form, Input, Select, InputNumber, Switch,
  Space, Popconfirm, Spin, Tag, Typography, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '../api';

const { Text } = Typography;

interface CredentialDetail {
  exists: boolean;
  username: string;
  password: string;
  extra: string;
}

interface Resource {
  id: string;
  name: string;
  url: string;
  group: string;
  loginMode: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
  healthCheckEnabled: boolean;
  credential: { id: string; username: string; hasPassword: boolean } | null;
  lastHealth: { status: string; responseMs: number | null; checkedAt: string; skipped?: boolean } | null;
}

export default function ResourcesPage() {
  const { message: messageApi } = App.useApp();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [credentialModalLoading, setCredentialModalLoading] = useState(false);
  const [credentialModalTitle, setCredentialModalTitle] = useState('查看凭据');
  const [credentialError, setCredentialError] = useState('');
  const [credentialData, setCredentialData] = useState<CredentialDetail | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/resources');
      setResources(res.data);
    } catch {
      messageApi.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const closeCredentialModal = () => {
    setCredentialModalOpen(false);
    setCredentialModalLoading(false);
    setCredentialModalTitle('查看凭据');
    setCredentialError('');
    setCredentialData(null);
    messageApi.destroy();
  };

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ group: 'default', loginMode: 'link', sortOrder: 0, enabled: true, healthCheckEnabled: true });
    setModalOpen(true);
  };

  const openEdit = async (r: Resource) => {
    setEditingId(r.id);
    form.resetFields();
    // 先获取凭据，确保弹窗打开时所有字段（含密码）已有值，避免 destroyOnClose 场景下竞态问题
    const values: Record<string, any> = {
      name: r.name, url: r.url, group: r.group,
      loginMode: r.loginMode, description: r.description,
      sortOrder: r.sortOrder, enabled: r.enabled,
      healthCheckEnabled: r.healthCheckEnabled,
    };
    try {
      const { data } = await api.get(`/resources/${r.id}/credential`);
      if (data && data.exists !== false) {
        values.credUsername = data.username ?? '';
        values.credPassword = data.password ?? '';
        values.credExtra = data.extra ?? '';
      }
    } catch { /* 凭据获取失败时保持空白 */ }
    form.setFieldsValue(values);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    // 编辑模式：用户名和密码均为空时不提交凭据字段（留空则不更新）
    if (editingId && !values.credUsername && !values.credPassword) {
      delete values.credUsername;
      delete values.credPassword;
      delete values.credExtra;
    }
    try {
      if (editingId) {
        await api.put(`/resources/${editingId}`, values);
        messageApi.success('已更新');
      } else {
        await api.post('/resources', values);
        messageApi.success('已创建');
      }
      setModalOpen(false);
      load();
    } catch {
      messageApi.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/resources/${id}`);
      messageApi.success('已删除');
      load();
    } catch {
      messageApi.error('删除失败');
    }
  };

  const handleCheck = async (id: string) => {
    try {
      await api.post(`/health/${id}/check`);
      messageApi.success('检测完成');
      load();
    } catch {
      messageApi.error('检测失败');
    }
  };

  const viewCredential = async (resource: Resource) => {
    messageApi.destroy();
    setCredentialModalTitle(resource.name ? `查看凭据 - ${resource.name}` : '查看凭据');
    setCredentialModalOpen(true);
    setCredentialModalLoading(true);
    setCredentialError('');
    setCredentialData(null);
    try {
      const res = await api.get(`/resources/${resource.id}/credential`);
      const data = res.data;
      if (!data || data.exists === false) {
        setCredentialData({ exists: false, username: '', password: '', extra: '' });
        return;
      }
      setCredentialData({
        exists: true,
        username: data.username ?? '',
        password: data.password ?? '',
        extra: data.extra ?? '',
      });
    } catch (err: any) {
      setCredentialError(err?.response?.data?.message || '凭据获取失败');
    } finally {
      setCredentialModalLoading(false);
    }
  };

  const renderCredentialValue = (value: string) => {
    if (!value) {
      return <Text type="secondary">（空）</Text>;
    }

    return (
      <Text copyable={{ text: value }} strong style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
        {value}
      </Text>
    );
  };

  const columns = [
    {
      title: '名称', dataIndex: 'name', key: 'name',
      render: (v: string, r: Resource) => (
        <Space>
          <Text strong>{v}</Text>
          {!r.enabled && <Tag color="default">已禁用</Tag>}
        </Space>
      ),
    },
    {
      title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true,
      render: (v: string) => <Text copyable style={{ fontSize: 12 }}>{v}</Text>,
    },
    { title: '分组', dataIndex: 'group', key: 'group', width: 100 },
    {
      title: '模式', dataIndex: 'loginMode', key: 'loginMode', width: 100,
      render: (v: string) => (
        <Tag color={v === 'auto' ? 'green' : v === 'semi-auto' ? 'orange' : 'blue'}>
          {v === 'auto' ? '自动' : v === 'semi-auto' ? '半自动' : '外链'}
        </Tag>
      ),
    },
    {
      title: '状态', key: 'status', width: 120,
      render: (_: any, r: Resource) => {
        if (!r.healthCheckEnabled) {
          return <Tag color="cyan">免检</Tag>;
        }
        const s = r.lastHealth?.status;
        return (
          <Space>
            <Tag color={s === 'up' ? 'success' : s === 'down' ? 'error' : 'default'}>
              {s === 'up' ? '正常' : s === 'down' ? '异常' : '未知'}
            </Tag>
            {r.lastHealth?.responseMs != null && <Text type="secondary">{r.lastHealth.responseMs}ms</Text>}
          </Space>
        );
      },
    },
    {
      title: '凭据', key: 'cred', width: 80, align: 'center' as const,
      render: (_: any, r: Resource) => r.credential?.hasPassword
        ? <Tag color="green">已配</Tag>
        : <Tag color="default">未配</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_: any, r: Resource) => (
        <Space size="small">
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="查看凭据"><Button size="small" icon={<EyeOutlined />} onClick={() => viewCredential(r)} /></Tooltip>
          <Tooltip title="立即检测"><Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleCheck(r.id)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 使用受控弹窗替代静态 Modal.info，避免 React 19 + antd v5 下点击后无可见反馈 */}
      <div className="resources-header">
        <Typography.Title level={4} style={{ margin: 0 }}>资源管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增资源</Button>
      </div>

      <Table
        dataSource={resources}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
      />

      <Modal
        title={editingId ? '编辑资源' : '新增资源'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如: Beszel业务监控" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true }]}>
            <Input placeholder="http://192.168.x.x:8090/" />
          </Form.Item>
          <Form.Item name="group" label="分组">
            <Input placeholder="default" />
          </Form.Item>
          <Form.Item name="loginMode" label="登录模式">
            <Select options={[
              { value: 'link', label: '外链直达' },
              { value: 'auto', label: '自动登录' },
              { value: 'semi-auto', label: '半自动（验证码）' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          {!editingId ? null : (
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Form.Item name="healthCheckEnabled" label="健康检查" valuePropName="checked"
            tooltip="关闭后不执行定时探测，状态始终显示为正常">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Typography.Title level={5}>登录凭据（加密存储）</Typography.Title>
          <Form.Item name="credUsername" label="用户名">
            <Input placeholder="留空则不更新" autoComplete="off" />
          </Form.Item>
          <Form.Item name="credPassword" label="密码">
            <Input.Password placeholder="留空则不更新" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="credExtra" label="附加信息">
            <Input.TextArea rows={2} placeholder="留空则不更新" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={credentialModalTitle}
        open={credentialModalOpen}
        onCancel={closeCredentialModal}
        destroyOnHidden
        footer={[
          <Button key="close" onClick={closeCredentialModal}>关闭</Button>,
        ]}
        width={520}
      >
        {credentialModalLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Space direction="vertical" align="center" size="middle">
              <Spin />
              <Text type="secondary">正在获取凭据...</Text>
            </Space>
          </div>
        ) : credentialError ? (
          <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
            {credentialError}
          </Typography.Paragraph>
        ) : credentialData?.exists === false ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            当前资源未配置凭据。
          </Typography.Paragraph>
        ) : credentialData ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">用户名</Text>
              <div>{renderCredentialValue(credentialData.username)}</div>
            </div>
            <div>
              <Text type="secondary">密码</Text>
              <div>{renderCredentialValue(credentialData.password)}</div>
            </div>
            <div>
              <Text type="secondary">附加信息</Text>
              <div>{renderCredentialValue(credentialData.extra)}</div>
            </div>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
