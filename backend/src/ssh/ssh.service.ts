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
    onData: (data: string) => void,
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

        stream.on('data', (data: Buffer) => onData(data.toString('utf8')));
        stream.stderr.on('data', (data: Buffer) => onData(data.toString('utf8')));
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
    }
  }

  /** Disconnect and clean up */
  disconnect(socketId: string): void {
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
