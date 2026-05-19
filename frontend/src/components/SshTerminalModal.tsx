import { useEffect, useRef, useState, useCallback } from 'react';
import { Modal, Button, Form, Input, Space, Typography, Spin, Tooltip } from 'antd';
import {
  ExpandOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../auth';
import '@xterm/xterm/css/xterm.css';

const { Text } = Typography;

export interface SshTerminalModalProps {
  open: boolean;
  resourceId: string;
  resourceName: string;
  /** Whether the resource has a stored private key credential */
  hasPrivateKey: boolean;
  onClose: () => void;
}

type ConnState = 'idle' | 'form' | 'connecting' | 'connected' | 'error' | 'closed';

export default function SshTerminalModal({
  open,
  resourceId,
  resourceName,
  hasPrivateKey,
  onClose,
}: SshTerminalModalProps) {
  const { token } = useAuth();
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Stores ssh:connect payload when socket connects before xterm is ready
  const pendingConnectRef = useRef<Record<string, string | number> | null>(null);
  const [connState, setConnState] = useState<ConnState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form] = Form.useForm<{ username: string; password: string }>();

  // ── Cleanup on unmount or close ──────────────────────────────────────────
  const cleanup = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    xtermRef.current?.dispose();
    xtermRef.current = null;
    fitAddonRef.current = null;
    pendingConnectRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setConnState('idle');
      setErrorMsg('');
      form.resetFields();
    }
  }, [open, cleanup, form]);

  // ── Initialize xterm when entering connected state ───────────────────────
  useEffect(() => {
    if (connState !== 'connecting' && connState !== 'connected') return;
    if (!termRef.current) return;
    if (xtermRef.current) return; // already initialized

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#00ff88',
        selectionBackground: 'rgba(0,255,136,0.3)',
      },
      allowTransparency: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Forward keyboard input to SSH
    term.onData((data) => {
      socketRef.current?.emit('ssh:data', { data });
    });

    // If ssh:connect was deferred (socket connected before xterm mounted), send it now
    if (pendingConnectRef.current && socketRef.current?.connected) {
      const payload = pendingConnectRef.current;
      payload.cols = term.cols;
      payload.rows = term.rows;
      socketRef.current.emit('ssh:connect', payload);
      pendingConnectRef.current = null;
    }

    // Sync actual terminal size to backend immediately after mount
    // (ssh:connect may have been sent before xterm was ready)
    const { cols, rows } = term;
    socketRef.current?.emit('ssh:resize', { cols, rows });
  }, [connState]);

  // ── Handle window resize ─────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (!fitAddonRef.current || !xtermRef.current) return;
      fitAddonRef.current.fit();
      const { cols, rows } = xtermRef.current;
      socketRef.current?.emit('ssh:resize', { cols, rows });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Connect to SSH via WebSocket ─────────────────────────────────────────
  const connectSsh = useCallback(
    (username?: string, password?: string) => {
      if (!token) return;
      setConnState('connecting');
      setErrorMsg('');

      // Determine WebSocket URL (same host, different path)
      const wsBase = window.location.origin.replace(/^http/, 'ws');

      const socket = io(`${wsBase}/ssh`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        // Send SSH connect request with current terminal dimensions
        const payload: Record<string, string | number> = { resourceId };
        if (username) payload.username = username;
        if (password) payload.password = password;
        // Pass actual terminal size so PTY is initialized correctly
        if (xtermRef.current) {
          payload.cols = xtermRef.current.cols;
          payload.rows = xtermRef.current.rows;
          socket.emit('ssh:connect', payload);
        } else {
          // xterm not yet mounted (React hasn't rendered yet); defer until after mount
          pendingConnectRef.current = payload;
        }
      });

      socket.on('connect_error', (err) => {
        setConnState('error');
        setErrorMsg(`WebSocket 连接失败: ${err.message}`);
      });

      socket.on('ssh:data', ({ data }: { data: string }) => {
        setConnState((prev) => prev === 'connecting' ? 'connected' : prev);
        xtermRef.current?.write(data);
      });

      socket.on('ssh:error', ({ message }: { message: string }) => {
        setConnState('error');
        setErrorMsg(message);
        xtermRef.current?.writeln(`\r\n\x1b[31m错误: ${message}\x1b[0m`);
      });

      socket.on('ssh:close', ({ message }: { message: string }) => {
        setConnState('closed');
        xtermRef.current?.writeln(`\r\n\x1b[33m${message}\x1b[0m`);
      });

      socket.on('disconnect', () => {
        setConnState((prev) => prev === 'connected' ? 'closed' : prev);
        xtermRef.current?.writeln('\r\n\x1b[33mWebSocket 连接已断开\x1b[0m');
      });
    },
    [token, resourceId],
  );

  // ── Auto-connect when modal opens (if has private key) ───────────────────
  useEffect(() => {
    if (!open || !token) return;
    if (connState !== 'idle') return;

    if (hasPrivateKey) {
      connectSsh();
    } else {
      setConnState('form');
    }
  }, [open, token, hasPrivateKey, connState, connectSsh]);

  // ── After xterm is mounted, fit and mark connected ───────────────────────
  useEffect(() => {
    if (connState !== 'connecting') return;
    // Give xterm a tick to mount, then fit
    const t = setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
    return () => clearTimeout(t);
  }, [connState]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFormSubmit = (values: { username: string; password: string }) => {
    connectSsh(values.username, values.password);
  };

  const handleDisconnect = () => {
    socketRef.current?.emit('ssh:disconnect');
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnState('closed');
  };

  const handleReconnect = () => {
    cleanup();
    setConnState('idle');
    setErrorMsg('');
    form.resetFields();
    // Re-trigger auto-connect logic
    setTimeout(() => {
      if (hasPrivateKey) {
        connectSsh();
      } else {
        setConnState('form');
      }
    }, 100);
  };

  const handleOpenNewTab = () => {
    window.open(`/terminal/${resourceId}`, '_blank', 'noopener');
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isTerminalVisible = connState === 'connecting' || connState === 'connected' || connState === 'closed';

  const titleBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 40 }}>
      <Space>
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
          🖥 SSH — {resourceName}
        </span>
        {connState === 'connected' && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
        )}
        {connState === 'connecting' && (
          <Spin size="small" />
        )}
        {(connState === 'closed' || connState === 'error') && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4d4f', display: 'inline-block' }} />
        )}
      </Space>
      <Space size={4}>
        {(connState === 'connected' || connState === 'connecting') && (
          <Tooltip title="断开连接">
            <Button size="small" type="text" icon={<DisconnectOutlined />} onClick={handleDisconnect} danger />
          </Tooltip>
        )}
        {(connState === 'closed' || connState === 'error') && (
          <Tooltip title="重新连接">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={handleReconnect} />
          </Tooltip>
        )}
        <Tooltip title="新标签页打开">
          <Button size="small" type="text" icon={<ExpandOutlined />} onClick={handleOpenNewTab} />
        </Tooltip>
      </Space>
    </div>
  );

  return (
    <Modal
      title={titleBar}
      open={open}
      onCancel={handleClose}
      footer={null}
      width="90vw"
      style={{ top: 20, maxWidth: 1200 }}
      styles={{
        body: { padding: 0, background: '#1a1a2e', borderRadius: '0 0 8px 8px' },
        header: { background: '#0d0d1a', borderBottom: '1px solid #333', borderRadius: '8px 8px 0 0' },
      }}
      destroyOnClose
      className="ssh-terminal-modal"
    >
      {/* Credential form (no private key) */}
      {connState === 'form' && (
        <div style={{ padding: 32, background: '#1a1a2e', borderRadius: '0 0 8px 8px' }}>
          <Text style={{ color: '#aaa', display: 'block', marginBottom: 20, fontSize: 13 }}>
            该资源未配置私钥凭据，请输入 SSH 登录信息：
          </Text>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFormSubmit}
            initialValues={{ username: 'root' }}
          >
            <Form.Item
              label={<span style={{ color: '#ccc' }}>用户名</span>}
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<span style={{ color: '#666' }}>$</span>}
                placeholder="root"
                style={{ background: '#0d0d1a', borderColor: '#333', color: '#e0e0e0' }}
              />
            </Form.Item>
            <Form.Item
              label={<span style={{ color: '#ccc' }}>密码</span>}
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                placeholder="SSH 密码"
                style={{ background: '#0d0d1a', borderColor: '#333', color: '#e0e0e0' }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" style={{ background: '#00b96b' }}>
                  连接
                </Button>
                <Button onClick={handleClose} style={{ borderColor: '#333', color: '#aaa', background: 'transparent' }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}

      {/* Error state (before terminal is shown) */}
      {connState === 'error' && !isTerminalVisible && (
        <div style={{ padding: 32, textAlign: 'center', background: '#1a1a2e', borderRadius: '0 0 8px 8px' }}>
          <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 12 }} />
          <div style={{ color: '#ff4d4f', marginBottom: 16 }}>{errorMsg}</div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReconnect}>重新连接</Button>
            <Button onClick={handleClose}>关闭</Button>
          </Space>
        </div>
      )}

      {/* Terminal container */}
      {isTerminalVisible && (
        <div
          ref={termRef}
          style={{
            width: '100%',
            height: '65vh',
            minHeight: 400,
            background: '#1a1a2e',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}
        />
      )}
    </Modal>
  );
}
