import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, InputNumber, Switch,
  Space, message, Popconfirm, Tag, Typography, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Text } = Typography;

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
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/resources');
      setResources(res.data);
    } catch { message.error('加载失败'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
        message.success('已更新');
      } else {
        await api.post('/resources', values);
        message.success('已创建');
      }
      setModalOpen(false);
      load();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/resources/${id}`);
      message.success('已删除');
      load();
    } catch { message.error('删除失败'); }
  };

  const handleCheck = async (id: string) => {
    try {
      await api.post(`/health/${id}/check`);
      message.success('检测完成');
      load();
    } catch { message.error('检测失败'); }
  };

  const viewCredential = async (id: string) => {
    const hide = message.loading('正在获取凭据…', 0);
    try {
      const res = await api.get(`/resources/${id}/credential`);
      hide();
      const data = res.data;
      if (!data || data.exists === false) {
        message.info('未配置凭据');
        return;
      }
      Modal.info({
        title: '凭据信息',
        width: 480,
        content: (
          <div style={{ marginTop: 12 }}>
            <p><strong>用户名：</strong><Text copyable>{data.username || '（空）'}</Text></p>
            <p><strong>密码：</strong><Text copyable>{data.password || '（空）'}</Text></p>
            {data.extra && <p><strong>附加：</strong><Text copyable>{data.extra}</Text></p>}
          </div>
        ),
      });
    } catch (err: any) {
      hide();
      message.error(err?.response?.data?.message || '凭据获取失败');
    }
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
          <Tooltip title="查看凭据"><Button size="small" icon={<EyeOutlined />} onClick={() => viewCredential(r.id)} /></Tooltip>
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
        destroyOnClose
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
    </div>
  );
}
