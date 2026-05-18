import { useEffect, useState, useMemo } from 'react';
import {
  App, Button, Modal, Form, Input, Select, InputNumber, Switch,
  Space, Popconfirm, Spin, Tag, Typography, Tooltip, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  ThunderboltOutlined, HolderOutlined,
} from '@ant-design/icons';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  groupSortOrder: number;
  loginMode: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
  healthCheckEnabled: boolean;
  credential: { id: string; username: string; hasPassword: boolean } | null;
  lastHealth: { status: string; responseMs: number | null; checkedAt: string; skipped?: boolean } | null;
}

interface GroupData {
  group: string;
  groupSortOrder: number;
  items: Resource[];
}

/* ===================== Sortable Group Component ===================== */
function SortableGroup({
  groupData, onResourceDragEnd, onEdit, onView, onCheck, onDelete,
}: {
  groupData: GroupData;
  onResourceDragEnd: (group: string, oldIndex: number, newIndex: number) => void;
  onEdit: (r: Resource) => void;
  onView: (r: Resource) => void;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group-${groupData.group}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 16,
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupData.items.findIndex((r) => r.id === active.id);
    const newIndex = groupData.items.findIndex((r) => r.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onResourceDragEnd(groupData.group, oldIndex, newIndex);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        title={
          <Space>
            <HolderOutlined
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab', color: '#999', fontSize: 16 }}
            />
            <Text strong>{groupData.group === 'default' ? '未分组' : groupData.group}</Text>
            <Tag>{groupData.items.length} 项</Tag>
          </Space>
        }
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={groupData.items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            {groupData.items.map((r) => (
              <SortableResourceRow
                key={r.id}
                resource={r}
                onEdit={onEdit}
                onView={onView}
                onCheck={onCheck}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
}

/* ===================== Sortable Resource Row ===================== */
function SortableResourceRow({
  resource: r, onEdit, onView, onCheck, onDelete,
}: {
  resource: Resource;
  onEdit: (r: Resource) => void;
  onView: (r: Resource) => void;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    background: isDragging ? '#fafafa' : '#fff',
    gap: 12,
  };

  const statusTag = () => {
    if (!r.healthCheckEnabled) return <Tag color="cyan">免检</Tag>;
    const s = r.lastHealth?.status;
    return (
      <Tag color={s === 'up' ? 'success' : s === 'down' ? 'error' : 'default'}>
        {s === 'up' ? '正常' : s === 'down' ? '异常' : '未知'}
      </Tag>
    );
  };

  return (
    <div ref={setNodeRef} style={style}>
      <HolderOutlined
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: '#bbb', fontSize: 14, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size="small" wrap>
          <Text strong>{r.name}</Text>
          {!r.enabled && <Tag color="default">已禁用</Tag>}
          <Tag color={r.loginMode === 'auto' ? 'green' : r.loginMode === 'semi-auto' ? 'orange' : 'blue'}>
            {r.loginMode === 'auto' ? '自动' : r.loginMode === 'semi-auto' ? '半自动' : '外链'}
          </Tag>
          {statusTag()}
          {r.credential?.hasPassword ? <Tag color="green">凭据已配</Tag> : null}
        </Space>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }} copyable>{r.url}</Text>
        </div>
      </div>
      <Space size="small" style={{ flexShrink: 0 }}>
        <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)} /></Tooltip>
        <Tooltip title="查看凭据"><Button size="small" icon={<EyeOutlined />} onClick={() => onView(r)} /></Tooltip>
        <Tooltip title="立即检测"><Button size="small" icon={<ThunderboltOutlined />} onClick={() => onCheck(r.id)} /></Tooltip>
        <Popconfirm title="确认删除？" onConfirm={() => onDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    </div>
  );
}

/* ===================== Main Page ===================== */
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

  // 按分组聚合，保持 groupSortOrder 排序
  const grouped: GroupData[] = useMemo(() => {
    const map = new Map<string, GroupData>();
    for (const r of resources) {
      if (!map.has(r.group)) {
        map.set(r.group, { group: r.group, groupSortOrder: r.groupSortOrder ?? 0, items: [] });
      }
      map.get(r.group)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.groupSortOrder - b.groupSortOrder);
  }, [resources]);

  const groupIds = useMemo(() => grouped.map((g) => `group-${g.group}`), [grouped]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  /* --- Group reorder --- */
  const handleGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = grouped.findIndex((g) => `group-${g.group}` === active.id);
    const newIndex = grouped.findIndex((g) => `group-${g.group}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(grouped, oldIndex, newIndex);
    // 乐观更新
    const reordered = newOrder.flatMap((g, gi) => g.items.map((r) => ({ ...r, groupSortOrder: gi })));
    setResources(reordered);

    try {
      await api.put('/resources/reorder/groups', {
        groups: newOrder.map((g, i) => ({ group: g.group, sortOrder: i })),
      });
    } catch {
      messageApi.error('分组排序保存失败');
      load();
    }
  };

  /* --- Resource reorder within group --- */
  const handleResourceDragEnd = async (group: string, oldIndex: number, newIndex: number) => {
    const groupData = grouped.find((g) => g.group === group);
    if (!groupData) return;

    const newItems = arrayMove(groupData.items, oldIndex, newIndex);
    // 乐观更新
    const updated = resources.map((r) => {
      if (r.group !== group) return r;
      const idx = newItems.findIndex((nr) => nr.id === r.id);
      return { ...r, sortOrder: idx };
    });
    setResources(updated);

    try {
      await api.put('/resources/reorder/items', {
        items: newItems.map((item, i) => ({ id: item.id, sortOrder: i })),
      });
    } catch {
      messageApi.error('资源排序保存失败');
      load();
    }
  };

  /* --- CRUD handlers (unchanged logic) --- */
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
    if (editingId) {
      if (!values.credUsername) delete values.credUsername;
      if (!values.credPassword) delete values.credPassword;
      if (!values.credExtra) delete values.credExtra;
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
    if (!value) return <Text type="secondary">（空）</Text>;
    return (
      <Text copyable={{ text: value }} strong style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
        {value}
      </Text>
    );
  };

  return (
    <div>
      <div className="resources-header">
        <Typography.Title level={4} style={{ margin: 0 }}>资源管理</Typography.Title>
        <Space>
          <Text type="secondary">拖拽 ⋮⋮ 图标可调整分组或资源顺序</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增资源</Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
          <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
            {grouped.map((g) => (
              <SortableGroup
                key={g.group}
                groupData={g}
                onResourceDragEnd={handleResourceDragEnd}
                onEdit={openEdit}
                onView={viewCredential}
                onCheck={handleCheck}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
        {!loading && resources.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Text type="secondary">暂无资源，点击"新增资源"添加。</Text>
          </div>
        )}
      </Spin>

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
          <Form.Item name="sortOrder" label="排序权重" tooltip="数值越小越靠前，也可通过拖拽调整">
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
