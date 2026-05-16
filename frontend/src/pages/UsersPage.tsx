import { useEffect, useState } from 'react';
import {
  App, Table, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Tag, Typography, Tooltip, Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import api from '../api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { message: messageApi } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

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
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_: any, r: User) => {
        const isLastAdmin = r.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1;
        return (
          <Space size="small">
            <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
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
            rules={editingId ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              placeholder={editingId ? '留空则不修改' : '设置登录密码'}
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
    </div>
  );
}
