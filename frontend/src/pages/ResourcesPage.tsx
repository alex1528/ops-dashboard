import { useEffect, useState, useMemo, useRef } from 'react';
import {
  App, Button, Modal, Form, Input, Switch, AutoComplete,
  Space, Popconfirm, Spin, Tag, Typography, Tooltip, Card, Upload, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined,
  ThunderboltOutlined, HolderOutlined, UploadOutlined, DownloadOutlined,
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
import { useAuth } from '../auth';

const { Text } = Typography;

interface CredentialDetail {
  exists: boolean;
  username: string;
  password: string;
  extra: string;
  privateKey: string;
  sshEnabled: boolean;
}

interface Resource {
  id: string;
  name: string;
  url: string;
  group: string;
  subGroup: string;
  groupSortOrder: number;
  description: string;
  sortOrder: number;
  enabled: boolean;
  healthCheckEnabled: boolean;
  ownerId?: string | null;
  credential: { id: string; username: string; hasPassword: boolean; hasPrivateKey?: boolean; sshEnabled?: boolean; webEnabled?: boolean } | null;
  lastHealth: { status: string; responseMs: number | null; checkedAt: string; skipped?: boolean } | null;
}

interface GroupData {
  group: string;
  groupSortOrder: number;
  items: Resource[];
}

/* ===================== Sortable Group Component ===================== */
function SortableGroup({
  groupData, onResourceDragEnd, onEdit, onView, onCheck, onDelete, canManage, isOwnerOrAdmin, isAdmin,
}: {
  groupData: GroupData;
  onResourceDragEnd: (group: string, oldIndex: number, newIndex: number) => void;
  onEdit: (r: Resource) => void;
  onView: (r: Resource) => void;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: (r: Resource) => boolean;
  isOwnerOrAdmin: (r: Resource) => boolean;
  isAdmin: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group-${groupData.group}`,
  });
  const groupContainerRef = useRef<HTMLDivElement | null>(null);

  const setGroupContainerRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    groupContainerRef.current = node;
  };

  useEffect(() => {
    const node = groupContainerRef.current;
    if (!node) return;
    node.style.transform = CSS.Transform.toString(transform) ?? '';
    node.style.transition = transition ?? '';
    node.style.opacity = isDragging ? '0.5' : '1';
  }, [transform, transition, isDragging]);

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
    <div ref={setGroupContainerRef} className="resources-group-wrap">
      <Card
        size="small"
        title={
          <Space>
            {isAdmin && (
              <HolderOutlined
                {...attributes}
                {...listeners}
                className="resources-group-handle"
              />
            )}
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
                canManage={canManage(r)}
                canFullManage={isOwnerOrAdmin(r)}
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
  resource: r, onEdit, onView, onCheck, onDelete, canManage, canFullManage,
}: {
  resource: Resource;
  onEdit: (r: Resource) => void;
  onView: (r: Resource) => void;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  canFullManage: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });
  const rowRef = useRef<HTMLDivElement | null>(null);

  const setRowContainerRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    rowRef.current = node;
  };

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    node.style.transform = CSS.Transform.toString(transform) ?? '';
    node.style.transition = transition ?? '';
    node.style.opacity = isDragging ? '0.5' : '1';
    // 使用 CSS 变量保证拖拽高亮在浅色与深色主题下都自然
    node.style.background = isDragging ? 'var(--surface-bg-muted)' : 'var(--surface-bg)';
  }, [transform, transition, isDragging]);

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
    <div ref={setRowContainerRef} className="resources-row">
      {canFullManage && (
        <HolderOutlined
          {...attributes}
          {...listeners}
          className="resources-row-handle"
        />
      )}
      <div className="resources-row-main">
        <Space size="small" wrap>
          <Text strong>{r.name}</Text>
          {!r.enabled && <Tag color="default">已禁用</Tag>}
          {r.credential && <Tag color="green">有凭据</Tag>}
          {statusTag()}
        </Space>
        <div>
          <Text type="secondary" className="resources-row-url" copyable>{r.url}</Text>
        </div>
      </div>
      <Space size="small" className="resources-row-actions">
        {canManage && <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)} /></Tooltip>}
        <Tooltip title="查看凭据"><Button size="small" icon={<EyeOutlined />} onClick={() => onView(r)} /></Tooltip>
        {canFullManage && <Tooltip title="立即检测"><Button size="small" icon={<ThunderboltOutlined />} onClick={() => onCheck(r.id)} /></Tooltip>}
        {canFullManage && (
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </Space>
    </div>
  );
}

/* ===================== Main Page ===================== */
export default function ResourcesPage() {
  const { message: messageApi } = App.useApp();
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [credentialModalLoading, setCredentialModalLoading] = useState(false);
  const [credentialModalTitle, setCredentialModalTitle] = useState('查看凭据');
  const [credentialError, setCredentialError] = useState('');
  const [credentialData, setCredentialData] = useState<CredentialDetail | null>(null);
  const [credentialResourceName, setCredentialResourceName] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [sshSwitchEnabled, setSshSwitchEnabled] = useState(false);
  const [webLoginSwitchEnabled, setWebLoginSwitchEnabled] = useState(false);
  const [credentialFillOnly, setCredentialFillOnly] = useState(false); // authorized user filling credentials only
  const [groupOptions, setGroupOptions] = useState<{ value: string }[]>([]);
  const [subGroupOptions, setSubGroupOptions] = useState<{ value: string }[]>([]);
  const [allGroupData, setAllGroupData] = useState<{ groups: string[]; subGroups: Record<string, string[]> }>({ groups: [], subGroups: {} });
  const [form] = Form.useForm();
  const privateKeyFileRef = useRef<HTMLInputElement>(null);

  const loadGroups = async () => {
    try {
      const res = await api.get('/resources/groups');
      setAllGroupData(res.data);
      setGroupOptions(res.data.groups.map((g: string) => ({ value: g })));
    } catch { /* ignore */ }
  };

  const handleGroupChange = (value: string) => {
    const subs = allGroupData.subGroups[value] || [];
    setSubGroupOptions(subs.map((s) => ({ value: s })));
  };

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

  useEffect(() => { load(); loadGroups(); }, []);

  const isAdmin = user?.role === 'admin';
  // Owner or admin: full management rights
  const isOwnerOrAdmin = (r: Resource) => isAdmin || r.ownerId === user?.id;
  // Authorized (non-owner) user: can fill web credentials if webEnabled is not yet ON
  // Note: backend GET /resources already filters by access, so visibility implies authorization
  const canFillCredential = (r: Resource) => {
    if (isOwnerOrAdmin(r)) return false; // owners use full edit mode
    // If resource is visible in list (backend authorized) and web credential not yet enabled
    return !(r.credential && r.credential.webEnabled);
  };
  // Combined: show edit button for owners/admins + show credential fill button for authorized users
  const canManage = (r: Resource) => isOwnerOrAdmin(r) || canFillCredential(r);

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
    setCredentialResourceName('');
    messageApi.destroy();
  };

  const openCreate = () => {
    setEditingId(null);
    setCredentialFillOnly(false);
    form.resetFields();
    setSshSwitchEnabled(false);
    setWebLoginSwitchEnabled(false);
    form.setFieldsValue({ group: '', subGroup: '', enabled: true, healthCheckEnabled: true, credSshEnabled: false, credWebLoginEnabled: false });
    handleGroupChange('');
    setModalOpen(true);
  };

  const openEdit = async (r: Resource) => {
    setEditingId(r.id);
    // Determine if this is a credential-fill-only mode (authorized non-owner user)
    const fillOnly = !isOwnerOrAdmin(r);
    setCredentialFillOnly(fillOnly);
    form.resetFields();
    setSshSwitchEnabled(false);
    setWebLoginSwitchEnabled(false);
    const values: Record<string, any> = {
      name: r.name, url: r.url, group: r.group, subGroup: r.subGroup || '',
      description: r.description,
      enabled: r.enabled,
      healthCheckEnabled: r.healthCheckEnabled,
    };
    handleGroupChange(r.group);
    try {
      const { data } = await api.get(`/resources/${r.id}/credential`);
      if (data && data.exists !== false) {
        values.credUsername = data.username ?? '';
        values.credPassword = data.password ?? '';
        values.credExtra = data.extra ?? '';
        values.credPrivateKey = data.privateKey ?? '';
        values.credSshEnabled = data.sshEnabled ?? false;
        values.credWebLoginEnabled = data.webEnabled ?? false;
        setSshSwitchEnabled(data.sshEnabled ?? false);
        setWebLoginSwitchEnabled(data.webEnabled ?? false);
      }
    } catch { /* 凭据获取失败时保持空白 */ }
    form.setFieldsValue(values);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    // credWebLoginEnabled is only a UI toggle, not a backend field
    delete values.credWebLoginEnabled;

    // Credential-fill-only mode: only send web credential fields
    if (credentialFillOnly) {
      const credValues: Record<string, any> = { credWebEnabled: webLoginSwitchEnabled };
      if (webLoginSwitchEnabled) {
        if (values.credUsername) credValues.credUsername = values.credUsername;
        if (values.credPassword) credValues.credPassword = values.credPassword;
        if (values.credExtra) credValues.credExtra = values.credExtra;
      }
      try {
        await api.put(`/resources/${editingId}`, credValues);
        messageApi.success('凭据已保存');
        setModalOpen(false);
        load();
      } catch (err: any) {
        messageApi.error(err?.response?.data?.message || '保存失败');
      }
      return;
    }

    // Always send the master switches so backend can handle credential deletion
    values.credWebEnabled = webLoginSwitchEnabled;
    values.credSshEnabled = sshSwitchEnabled;

    if (editingId) {
      // When web cred switch is OFF, don't send credential fields (backend handles deletion)
      if (!webLoginSwitchEnabled) {
        delete values.credUsername;
        delete values.credPassword;
        delete values.credExtra;
      } else {
        if (!values.credUsername) delete values.credUsername;
        if (!values.credPassword) delete values.credPassword;
        if (!values.credExtra) delete values.credExtra;
      }
      // When SSH switch is OFF, don't send private key
      if (!sshSwitchEnabled) {
        delete values.credPrivateKey;
      } else {
        if (!values.credPrivateKey) delete values.credPrivateKey;
      }
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
    setCredentialResourceName(resource.name || resource.id);
    setCredentialModalOpen(true);
    setCredentialModalLoading(true);
    setCredentialError('');
    setCredentialData(null);
    setShowPrivateKey(false);
    try {
      const res = await api.get(`/resources/${resource.id}/credential`);
      const data = res.data;
      if (!data || data.exists === false) {
        setCredentialData({ exists: false, username: '', password: '', extra: '', privateKey: '', sshEnabled: false });
        return;
      }
      setCredentialData({
        exists: true,
        username: data.username ?? '',
        password: data.password ?? '',
        extra: data.extra ?? '',
        privateKey: data.privateKey ?? '',
        sshEnabled: data.sshEnabled ?? false,
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
      <Text copyable={{ text: value }} strong className="resources-copy-value">
        {value}
      </Text>
    );
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

  return (
    <div>
      <div className="resources-header">
        <Typography.Title level={4} className="page-title-inline">资源管理</Typography.Title>
        <Space>
          {isAdmin && <Text type="secondary">拖拽 ⋮⋮ 图标可调整分组或资源顺序</Text>}
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
                canManage={canManage}
                isOwnerOrAdmin={isOwnerOrAdmin}
                isAdmin={isAdmin}
              />
            ))}
          </SortableContext>
        </DndContext>
        {!loading && resources.length === 0 && (
          <div className="resources-empty">
            <Text type="secondary">暂无资源，点击"新增资源"添加。</Text>
          </div>
        )}
      </Spin>

      <Modal
        title={credentialFillOnly ? '录入Web系统凭据' : (editingId ? '编辑资源' : '新增资源')}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {!credentialFillOnly && (
            <>
              <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                <Input placeholder="如: Beszel业务监控" />
              </Form.Item>
              <Form.Item name="url" label="URL" rules={[{ required: true }]}>
                <Input placeholder="http://192.168.x.x:8090/" />
              </Form.Item>
              <Form.Item name="group" label="分组">
                <AutoComplete
                  placeholder="输入或选择分组"
                  options={groupOptions}
                  filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                  onChange={handleGroupChange}
                />
              </Form.Item>
              <Form.Item name="subGroup" label="子分组">
                <AutoComplete
                  placeholder="可选，留空则不分子组"
                  options={subGroupOptions}
                  filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} />
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
            </>
          )}

          <Typography.Title level={5} className="resources-section-title">
            Web系统账号信息(加密存储)
          </Typography.Title>
          <Typography.Text type="secondary" className="resources-section-note">
            记录目标资源的Web系统账号凭据信息，加密存储于数据库中
          </Typography.Text>
          <Form.Item
            name="credWebLoginEnabled"
            label="启用Web系统账号凭据"
            valuePropName="checked"
            tooltip="开启后可记录该资源的Web系统用户名和密码等信息"
          >
            <Switch
              checkedChildren="已启用"
              unCheckedChildren="未启用"
              onChange={(v) => setWebLoginSwitchEnabled(v)}
            />
          </Form.Item>
          {webLoginSwitchEnabled && (
            <>
              <Form.Item name="credUsername" label="用户名">
                <Input placeholder="留空则不更新" autoComplete="off" />
              </Form.Item>
              <Form.Item name="credPassword" label="密码">
                <Input.Password placeholder="留空则不更新" autoComplete="new-password" />
              </Form.Item>
              <Form.Item name="credExtra" label="附加信息">
                <Input.TextArea rows={2} placeholder="留空则不更新" />
              </Form.Item>
            </>
          )}

          {!credentialFillOnly && (
            <>
              <Typography.Title level={5} className="resources-section-title">
                Linux SSH凭据(Web Terminal)
              </Typography.Title>
              <Typography.Text type="secondary" className="resources-section-note">
                用于通过浏览器内置 Web Terminal 以 SSH 方式登录目标 Linux amd64 服务器
              </Typography.Text>
              <Form.Item
                name="credSshEnabled"
                label="启用Web Terminal(SSH)"
                valuePropName="checked"
                tooltip="开启后，已登录用户可在卡片上点击 SSH 按钮直接通过浏览器登录该服务器"
              >
                <Switch
                  checkedChildren="已启用"
                  unCheckedChildren="未启用"
                  onChange={(v) => setSshSwitchEnabled(v)}
                />
              </Form.Item>
              {sshSwitchEnabled && (
                <>
                  <Form.Item
                    name="credPrivateKey"
                    label="私钥(PEM)"
                    tooltip="支持上传文件或直接粘贴 PEM 内容，留空则不更新"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="粘贴 PEM 私钥内容，或点击下方按钮上传文件，留空则不更新"
                      className="resources-private-key-input"
                    />
                  </Form.Item>
                  {/* 隐藏的文件输入，用于上传私钥文件 */}
                  <input
                    ref={privateKeyFileRef}
                    type="file"
                    accept=".pem,.key,.txt"
                    aria-label="上传 PEM 私钥文件"
                    title="上传 PEM 私钥文件"
                    className="resources-hidden-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const content = ev.target?.result as string;
                        form.setFieldValue('credPrivateKey', content);
                        messageApi.success(`已读取文件：${file.name}`);
                      };
                      reader.readAsText(file);
                      e.target.value = ''; // 允许重复选择同一文件
                    }}
                  />
                  <Form.Item label=" " colon={false}>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => privateKeyFileRef.current?.click()}
                    >
                      上传私钥文件
                    </Button>
                    <Text type="secondary" className="resources-upload-hint">
                      支持 .pem / .key / .txt 格式
                    </Text>
                  </Form.Item>
                </>
              )}
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title={credentialModalTitle}
        open={credentialModalOpen}
        onCancel={closeCredentialModal}
        destroyOnHidden
        footer={[
          credentialData?.exists && credentialData.privateKey ? (
            <Button
              key="download"
              icon={<DownloadOutlined />}
              onClick={() => downloadPrivateKey(credentialData.privateKey, credentialResourceName)}
            >
              下载私钥 (.pem)
            </Button>
          ) : null,
          <Button key="close" onClick={closeCredentialModal}>关闭</Button>,
        ]}
        width={560}
      >
        {credentialModalLoading ? (
          <div className="resources-credential-loading">
            <Space direction="vertical" align="center" size="middle">
              <Spin />
              <Text type="secondary">正在获取凭据...</Text>
            </Space>
          </div>
        ) : credentialError ? (
          <Typography.Paragraph type="danger" className="resources-credential-paragraph">
            {credentialError}
          </Typography.Paragraph>
        ) : credentialData?.exists === false ? (
          <Typography.Paragraph type="secondary" className="resources-credential-paragraph">
            当前资源未配置凭据。
          </Typography.Paragraph>
        ) : credentialData ? (
          <Space direction="vertical" size="large" className="resources-credential-space">
            <Typography.Text type="secondary" className="resources-credential-section-label">
              Web系统账号信息
            </Typography.Text>
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
            <Divider className="resources-credential-divider" />
            <Typography.Text type="secondary" className="resources-credential-section-label">
              Linux SSH凭据(Web Terminal)
            </Typography.Text>
            <div>
              <Text type="secondary">Web Terminal (SSH)</Text>
              <div>
                {credentialData.sshEnabled
                  ? <Tag color="green">已启用</Tag>
                  : <Tag color="default">未启用</Tag>}
              </div>
            </div>
            {credentialData.privateKey && (
              <div>
                <div className="dash-cred-key-header">
                  <Text type="secondary">私钥(PEM)</Text>
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
                    value={credentialData.privateKey}
                    readOnly
                    rows={6}
                    className="dash-cred-privatekey"
                  />
                )}
              </div>
            )}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
