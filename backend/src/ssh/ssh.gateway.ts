import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SshService } from './ssh.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

@WebSocketGateway({
  namespace: '/ssh',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class SshGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SshGateway.name);

  constructor(
    private readonly sshService: SshService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  /** Verify JWT on WebSocket handshake */
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.query?.token as string);

      if (!token) throw new UnauthorizedException('No token');

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new UnauthorizedException('Server misconfigured');

      const payload = this.jwt.verify(token, { secret });
      // Attach user info to socket for later use
      (client as any).user = { id: payload.sub, username: payload.username, role: payload.role };
      this.logger.log(`SSH WS connected: socket=${client.id} user=${payload.username}`);
    } catch (err) {
      this.logger.warn(`SSH WS rejected: socket=${client.id} reason=${(err as Error).message}`);
      client.emit('ssh:error', { message: '认证失败，请重新登录' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`SSH WS disconnected: socket=${client.id}`);
    this.sshService.disconnect(client.id);
  }

  /**
   * Client sends: { resourceId, username?, password? }
   * - If resource has a privateKey credential → use it (ignore username/password from client)
   * - Otherwise → use username/password provided by client
   */
  @SubscribeMessage('ssh:connect')
  async handleSshConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { resourceId: string; username?: string; password?: string; cols?: number; rows?: number },
  ) {
    const user = (client as any).user;
    if (!user) {
      client.emit('ssh:error', { message: '未授权' });
      return;
    }

    const { resourceId, username: clientUsername, password: clientPassword, cols: clientCols, rows: clientRows } = payload;

    // Load resource
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: { credential: true },
    });

    if (!resource) {
      client.emit('ssh:error', { message: '资源不存在' });
      return;
    }

    // Permission check: non-admin users must have explicit access
    if (user.role !== 'admin') {
      const hasAccess = await this.users.hasResourceAccess(user.id, resourceId);
      if (!hasAccess) {
        client.emit('ssh:error', { message: '无权访问该资源' });
        return;
      }
    }

    // Parse SSH host from resource URL
    let host: string;
    try {
      const parsed = new URL(resource.url);
      host = parsed.hostname;
    } catch {
      // Fallback: treat url as plain hostname
      host = resource.url.replace(/^(ssh|https?):\/\//, '').split('/')[0].split(':')[0];
    }

    const port = 22;
    const sshUsername = 'root';

    // Determine auth method
    const cred = resource.credential;
    let connectConfig: import('ssh2').ConnectConfig;

    if (cred?.privateKey && cred.privateKey !== '') {
      // Use stored private key (decrypted server-side)
      const decryptedKey = this.crypto.decrypt(cred.privateKey);
      connectConfig = {
        host,
        port,
        username: sshUsername,
        privateKey: decryptedKey,
        readyTimeout: 15000,
      };
      this.logger.log(`SSH connect via privateKey: ${sshUsername}@${host} (resource=${resourceId})`);
    } else if (clientUsername && clientPassword) {
      // Use username/password provided by client
      connectConfig = {
        host,
        port,
        username: clientUsername,
        password: clientPassword,
        readyTimeout: 15000,
      };
      this.logger.log(`SSH connect via password: ${clientUsername}@${host} (resource=${resourceId})`);
    } else {
      client.emit('ssh:error', { message: '无可用凭据，请提供用户名和密码' });
      return;
    }

    // Audit log
    await this.audit.log(user.id, 'ssh.connect', resourceId, `host=${host}`, client.handshake.address);

    // Establish SSH connection with actual terminal dimensions from client
    const initCols = (clientCols && clientCols > 0) ? clientCols : 220;
    const initRows = (clientRows && clientRows > 0) ? clientRows : 50;
    this.sshService.connect(
      client.id,
      connectConfig,
      initCols,
      initRows,
      (data) => client.emit('ssh:data', { data }),
      () => client.emit('ssh:close', { message: 'SSH 连接已关闭' }),
      (msg) => client.emit('ssh:error', { message: msg }),
    );
  }

  /** Client sends keyboard input */
  @SubscribeMessage('ssh:data')
  handleData(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { data: string },
  ) {
    this.sshService.write(client.id, payload.data);
  }

  /** Client resizes terminal window */
  @SubscribeMessage('ssh:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { cols: number; rows: number },
  ) {
    this.sshService.resize(client.id, payload.cols, payload.rows);
  }

  /** Client requests disconnect */
  @SubscribeMessage('ssh:disconnect')
  handleSshDisconnect(@ConnectedSocket() client: Socket) {
    this.sshService.disconnect(client.id);
    client.emit('ssh:close', { message: 'SSH 连接已断开' });
  }
}
