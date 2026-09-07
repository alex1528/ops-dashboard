import { Injectable, Logger } from '@nestjs/common';
import { Client as SshClient, ConnectConfig } from 'ssh2';

export interface SshSession {
  client: SshClient;
  stream: any;
}

@Injectable()
export class SshService {
  private readonly logger = new Logger(SshService.name);
  /** Map from socket.id → SshSession */
  private sessions = new Map<string, SshSession>();
  /** Resize requests that arrive before the shell is ready, keyed by socket.id */
  private pendingResizes = new Map<string, { cols: number; rows: number }>();

  /**
   * Establish an SSH PTY connection.
   * @param socketId  socket.io socket id (used as session key)
   * @param config    ssh2 ConnectConfig (host, port, username, privateKey or password)
   * @param cols      initial terminal columns
   * @param rows      initial terminal rows
   * @param onData    callback for terminal output data
   * @param onClose   callback when SSH connection closes
   * @param onError   callback on SSH error
   */
  connect(
    socketId: string,
    config: ConnectConfig,
    cols: number,
    rows: number,
    onData: (data: Buffer) => void,
    onClose: () => void,
    onError: (msg: string) => void,
  ): void {
    // Clean up any existing session for this socket
    this.disconnect(socketId);

    const client = new SshClient();

    client.on('ready', () => {
      this.logger.log(`SSH connected for socket ${socketId} → ${config.host}`);
      client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
        if (err) {
          onError(`Shell error: ${err.message}`);
          client.end();
          return;
        }

        this.sessions.set(socketId, { client, stream });

        // Apply any resize that arrived before the shell was ready
        const pending = this.pendingResizes.get(socketId);
        if (pending) {
          this.pendingResizes.delete(socketId);
          try {
            stream.setWindow(pending.rows, pending.cols, 0, 0);
          } catch { /* ignore */ }
        }

        // Forward raw bytes without decoding. SSH/TCP can split a multi-byte
        // UTF-8 sequence (box-drawing chars, status lines, any non-ASCII) across
        // two chunks; decoding each chunk independently corrupts the stream and
        // breaks full-screen TUI apps like vim/htop. Let xterm.js decode instead.
        stream.on('data', (data: Buffer) => onData(data));
        stream.stderr.on('data', (data: Buffer) => onData(data));
        stream.on('close', () => {
          this.logger.log(`SSH stream closed for socket ${socketId}`);
          this.sessions.delete(socketId);
          onClose();
        });
      });
    });

    client.on('error', (err) => {
      this.logger.warn(`SSH error for socket ${socketId}: ${err.message}`);
      this.sessions.delete(socketId);
      onError(`SSH 连接失败: ${err.message}`);
    });

    client.on('close', () => {
      this.sessions.delete(socketId);
    });

    client.connect(config);
  }

  /** Send keyboard input to the SSH stream */
  write(socketId: string, data: string): void {
    const session = this.sessions.get(socketId);
    if (session?.stream) {
      session.stream.write(data);
    }
  }

  /** Resize the PTY window */
  resize(socketId: string, cols: number, rows: number): void {
    const session = this.sessions.get(socketId);
    if (session?.stream) {
      session.stream.setWindow(rows, cols, 0, 0);
    } else {
      // Shell not ready yet — remember the latest size and apply on ready
      this.pendingResizes.set(socketId, { cols, rows });
    }
  }

  /** Disconnect and clean up */
  disconnect(socketId: string): void {
    this.pendingResizes.delete(socketId);
    const session = this.sessions.get(socketId);
    if (session) {
      try {
        session.stream?.end();
        session.client.end();
      } catch { /* ignore */ }
      this.sessions.delete(socketId);
    }
  }

  /** Check if a session exists */
  hasSession(socketId: string): boolean {
    return this.sessions.has(socketId);
  }
}
