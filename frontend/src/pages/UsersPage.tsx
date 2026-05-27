import { useEffect, useState } from 'react';
import {
  App, Table, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Tag, Typography, Tooltip, Tree,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, SafetyOutlined, MailOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  activated: boolean;
  createdAt: string;
}

interface ResourceItem {
  id: string;
  name: string;
  group: string;
}

interface PermissionItem {
  type: 'group' | 'resource';
  target: string;
}

export default function UsersPage() {
  const { message: messageApi } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Permission modal state
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [permUserName, setPermUserName] = useState('');
  const [permLoading, setPermLoading] = useState(false);
  const [permResources, setPermResources] = useState<ResourceItem[]>([]);
  const [permCheckedKeys, setPermCheckedKeys] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      messageApi.error('加载用户列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ role: 'user' });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingId(u.id);
    form.resetFields();
    form.setFieldsValue({ email: u.email, role: u.role });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    // 编辑模式：密码为空时不提交
    if (editingId && !values.password) {
      delete values.password;
    }
    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, values);
        messageApi.success('用户已更新');
      } else {
        await api.post('/users', values);
        messageApi.success('用户已创建');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      messageApi.success('用户已删除');
      load();
    } catch {
      messageApi.error('删除失败');
    }
  };

  const handleResetMfa = async (id: string) => {
    try {
      await api.put(`/users/${id}`, { mfaEnabled: false });
      messageApi.success('MFA 已重置');
      load();
    } catch {
      messageApi.error('重置失败');
    }
  };

  const handleSendActivation = async (id: string) => {
    try {
      await api.post(`/users/${id}/send-activation`);
      messageApi.success('激活邮件已发送');
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '发送激活邮件失败');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.put(`/users/${id}`, { activated: true });
      messageApi.success('已手动激活该用户');
      load();
    } catch (err: any) {
      messageApi.error(err?.response?.data?.message || '激活失败');
    }
  };

  /** Open permission config modal for a user */
  const openPermModal = async (u: User) => {
    setPermUserId(u.id);
    setPermUserName(u.username);
    setPermModalOpen(true);
    setPermLoading(true);
    try {
      const [resRes, permRes] = await Promise.all([
        api.get('/resources'),
        api.get(`/users/${u.id}/permissions`),
      ]);
      const allResources: ResourceItem[] = (resRes.data || []).map((r: any) => ({
        id: r.id, name: r.name, group: r.group,
      }));
      setPermResources(allResources);
      // Convert permissions to checked keys
      const perms: PermissionItem[] = permRes.data || [];
      const keys: string[] = [];
      for (const p of perms) {
        if (p.type === 'group') keys.push(`group:${p.target}`);
        else keys.push(`resource:${p.target}`);
      }
      setPermCheckedKeys(keys);
    } catch {
      messageApi.error('加载权限信息失败');
    }
    setPermLoading(false);
  };

  /** Save permissions */
  const handleSavePermissions = async () => {
    if (!permUserId) return;
    // Convert checked keys back to permission items
    const permissions: PermissionItem[] = [];
    const checkedGroups = new Set<string>();
    for (const key of permCheckedKeys) {
      if (key.startsWith('group:')) {
        const group = key.slice(6);
        permissions.push({ type: 'group', target: group });
        checkedGroups.add(group);
      }
    }
    for (const key of permCheckedKeys) {
      if (key.startsWith('resource:')) {
        const resourceId = key.slice(9);
        // Skip individual resource if its group is already fully checked
        const resource = permResources.find((r) => r.id === resourceId);
        if (resource && checkedGroups.has(resource.group)) continue;
        permissions.push({ type: 'resource', target: resourceId });
      }
    }
    try {
      await api.put(`/users/${permUserId}/permissions`, { permissions });
      messageApi.success('权限已更新');
      setPermModalOpen(false);
    } catch {
      messageApi.error('权限保存失败');
    }
  };

  /** Build tree data from resources grouped by group */
  const buildPermTreeData = () => {
    const groupMap: Record<string, ResourceItem[]> = {};
    for (const r of permResources) {
      (groupMap[r.group] = groupMap[r.group] || []).push(r);
    }
    return Object.entries(groupMap).map(([group, items]) => ({
      title: `${group}（分组）`,
      key: `group:${group}`,
      children: items.map((r) => ({
        title: r.name,
        key: `resource:${r.id}`,
      })),
    }));
  };

  const columns = [
    {
      title: '用户名', dataIndex: 'username', key: 'username',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: '邮箱', dataIndex: 'email', key: 'email',
      render: (v: string) => v || <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 100,
      render: (v: string) => (
        <Tag color={v === 'admin' ? 'red' : 'blue'}>
          {v === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: 'MFA', dataIndex: 'mfaEnabled', key: 'mfa', width: 80,
      render: (v: boolean) => v ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>,
    },
    {
      title: '状态', dataIndex: 'activated', key: 'activated', width: 80,
      render: (v: boolean) => v ? <Tag color="green">已激活</Tag> : <Tag color="orange">未激活</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 280,
      render: (_: any, r: User) => {
        const isLastAdmin = r.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1;
        return (
          <Space size="small">
            <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
            {!r.activated && r.email && (
              <Tooltip title="发送激活邮件"><Button size="small" icon={<MailOutlined />} onClick={() => handleSendActivation(r.id)} /></Tooltip>
            )}
            {!r.activated && (
              <Popconfirm title="确认手动激活此用户？" onConfirm={() => handleActivate(r.id)}>
                <Tooltip title="置为激活"><Button size="small" icon={<CheckCircleOutlined />} /></Tooltip>
              </Popconfirm>
            )}
            {r.role === 'user' && (
              <Tooltip title="权限"><Button size="small" icon={<SafetyOutlined />} onClick={() => openPermModal(r)} /></Tooltip>
            )}
            {r.mfaEnabled && (
              <Popconfirm title="确认重置此用户的 MFA？" onConfirm={() => handleResetMfa(r.id)}>
                <Tooltip title="重置 MFA"><Button size="small" icon={<LockOutlined />} /></Tooltip>
              </Popconfirm>
            )}
            <Tooltip title={isLastAdmin ? '不能删除最后一个管理员' : '删除用户'}>
              <Popconfirm
                title="确认删除此用户？"
                onConfirm={() => handleDelete(r.id)}
                disabled={isLastAdmin}
              >
                <Button size="small" danger icon={<DeleteOutlined />} disabled={isLastAdmin} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="resources-header">
        <Typography.Title level={4} className="page-title-inline">用户管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增用户</Button>
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingId ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={500}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {!editingId && (
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="登录用户名" autoComplete="off" />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label="密码"
            rules={editingId ? [] : []}
            extra={!editingId ? '留空则需要通过激活邮件设置密码' : undefined}
          >
            <Input.Password
              placeholder={editingId ? '留空则不修改' : '设置登录密码（可选）'}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input type="email" placeholder="user@example.com" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={[
              { value: 'admin', label: '管理员' },
              { value: 'user', label: '普通用户' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Permission config modal */}
      <Modal
        title={`资源权限 — ${permUserName}`}
        open={permModalOpen}
        onOk={handleSavePermissions}
        onCancel={() => setPermModalOpen(false)}
        width={520}
        destroyOnHidden
        confirmLoading={permLoading}
      >
        {permLoading ? (
          <div className="perm-loading">加载中...</div>
        ) : permResources.length === 0 ? (
          <Typography.Text type="secondary">暂无可分配的资源</Typography.Text>
        ) : (
          <>
            <Typography.Paragraph type="secondary" className="perm-hint">
              勾选分组将授权该组下全部资源，也可展开分组单独授权某个资源。未勾选任何资源时该用户无法查看任何目标。
            </Typography.Paragraph>
            <Tree
              checkable
              defaultExpandAll
              checkedKeys={permCheckedKeys}
              onCheck={(checked) => setPermCheckedKeys(checked as string[])}
              treeData={buildPermTreeData()}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
