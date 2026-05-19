import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Space, Spin, Typography } from 'antd';
import {
  ArrowLeftOutlined,
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

type ConnState = 'idle' | 'form' | 'connecting' | 'connected' | 'error' | 'closed';

export default function TerminalPage() {
  const { id: resourceId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { token, isAuthenticated } = useAuth();

  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [connState, setConnState] = useState<ConnState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [hasPrivateKey, setHasPrivateKey] = useState<boolean | null>(null);
  const [form] = Form.useForm<{ username: string; password: string }>();

  // ── Redirect if not authenticated ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      nav('/login');
    }
  }, [isAuthenticated, nav]);

  // ── Fetch resource info ───────────────────────────────────────────────────
  useEffect(() => {
    if (!resourceId || !token) return;
    fetch('/api/health/status')
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string; hasPrivateKey?: boolean }>) => {
        const r = data.find((x) => x.id === resourceId);
        if (r) {
          setResourceName(r.name);
          setHasPrivateKey(!!r.hasPrivateKey);
        }
      })
      .catch(() => {});
  }, [resourceId, token]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    xtermRef.current?.dispose();
    xtermRef.current = null;
    fitAddonRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Initialize xterm ──────────────────────────────────────────────────────
  useEffect(() => {
    if (connState !== 'connecting' && connState !== 'connected') return;
    if (!termRef.current || xtermRef.current) return;

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
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      socketRef.current?.emit('ssh:data', { data });
    });
  }, [connState]);

  // ── Window resize ─────────────────────────────────────────────────────────
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

  // ── Connect SSH ───────────────────────────────────────────────────────────
  const connectSsh = useCallback(
    (username?: string, password?: string) => {
      if (!token || !resourceId) return;
      setConnState('connecting');
      setErrorMsg('');

      const wsBase = window.location.origin.replace(/^http/, 'ws');
      const socket = io(`${wsBase}/ssh`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        const payload: Record<string, string> = { resourceId };
        if (username) payload.username = username;
        if (password) payload.password = password;
        socket.emit('ssh:connect', payload);
      });

      socket.on('connect_error', (err) => {
        setConnState('error');
        setErrorMsg(`WebSocket 连接失败: ${err.message}`);
      });

      socket.on('ssh:data', ({ data }: { data: string }) => {
        setConnState('connected');
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
        setConnState('closed');
        xtermRef.current?.writeln('\r\n\x1b[33mWebSocket 连接已断开\x1b[0m');
      });
    },
    [token, resourceId],
  );

  // ── Auto-connect once hasPrivateKey is known ──────────────────────────────
  useEffect(() => {
    if (hasPrivateKey === null || connState !== 'idle') return;
    if (hasPrivateKey) {
      connectSsh();
    } else {
      setConnState('form');
    }
  }, [hasPrivateKey, connState, connectSsh]);

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
    setTimeout(() => {
      if (hasPrivateKey) {
        connectSsh();
      } else {
        setConnState('form');
      }
    }, 100);
  };

  const isTerminalVisible = connState === 'connecting' || connState === 'connected' || connState === 'closed';

  return (
    <div className="terminal-page">
      {/* Top bar */}
      <div className="terminal-page-bar">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => nav('/')}
            style={{ color: '#aaa' }}
          >
            返回
          </Button>
          <span style={{ color: '#ccc', fontFamily: 'monospace', fontSize: 13 }}>
            🖥 SSH — {resourceName || resourceId}
          </span>
          {connState === 'connected' && (
            <span className="terminal-status-dot terminal-status-dot--on" />
          )}
          {connState === 'connecting' && <Spin size="small" />}
          {(connState === 'closed' || connState === 'error') && (
            <span className="terminal-status-dot terminal-status-dot--off" />
          )}
        </Space>
        <Space>
          {(connState === 'connected' || connState === 'connecting') && (
            <Button
              size="small"
              icon={<DisconnectOutlined />}
              onClick={handleDisconnect}
              danger
            >
              断开
            </Button>
          )}
          {(connState === 'closed' || connState === 'error') && (
            <Button size="small" icon={<ReloadOutlined />} onClick={handleReconnect}>
              重连
            </Button>
          )}
        </Space>
      </div>

      {/* Credential form */}
      {connState === 'form' && (
        <div className="terminal-page-form">
          <Text style={{ color: '#aaa', display: 'block', marginBottom: 20, fontSize: 13 }}>
            该资源未配置私钥凭据，请输入 SSH 登录信息：
          </Text>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFormSubmit}
            initialValues={{ username: 'root' }}
            style={{ maxWidth: 400 }}
          >
            <Form.Item
              label={<span style={{ color: '#ccc' }}>用户名</span>}
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
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
            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ background: '#00b96b' }}>
                连接
              </Button>
            </Form.Item>
          </Form>
        </div>
      )}

      {/* Error state */}
      {connState === 'error' && !isTerminalVisible && (
        <div className="terminal-page-error">
          <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 12 }} />
          <div style={{ color: '#ff4d4f', marginBottom: 16 }}>{errorMsg}</div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReconnect}>重新连接</Button>
            <Button onClick={() => nav('/')}>返回首页</Button>
          </Space>
        </div>
      )}

      {/* Terminal */}
      {isTerminalVisible && (
        <div ref={termRef} className="terminal-page-term" />
      )}
    </div>
  );
}
