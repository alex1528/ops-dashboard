import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreateUserDto, UpdateUserDto, UpdateUserPermissionsDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async findAll() {
    const users = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      mfaEnabled: u.mfaEnabled,
      activated: u.activated,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async findOne(id: string) {
    const u = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
    if (exists) throw new ConflictException('用户名已存在');
    const hash = dto.password ? await bcrypt.hash(dto.password, 12) : '';
    const user = await this.prisma.adminUser.create({
      data: {
        username: dto.username,
        password: hash,
        email: dto.email || '',
        role: dto.role || 'user',
        activated: false,
        mustChangePassword: true,
        mustSetupMfa: true,
      },
    });
    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
      // 管理员重置密码后，要求用户下次登录强制改密
      data.mustChangePassword = true;
    }
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    // Admin can force-disable MFA for a user
    if (dto.mfaEnabled === false) {
      data.mfaEnabled = false;
      data.mfaSecret = '';
    }
    await this.prisma.adminUser.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    // Prevent deleting the last admin user — would lock out the system
    if (existing.role === 'admin') {
      const adminCount = await this.prisma.adminUser.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('不能删除系统中最后一个管理员账号');
      }
    }
    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true };
  }

  /** Get permissions for a user */
  async getPermissions(userId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const permissions = await this.prisma.userPermission.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return permissions.map((p) => ({ id: p.id, type: p.type, target: p.target }));
  }

  /** Replace all permissions for a user */
  async updatePermissions(userId: string, dto: UpdateUserPermissionsDto) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    // Delete existing permissions and recreate
    await this.prisma.userPermission.deleteMany({ where: { userId } });
    if (dto.permissions.length > 0) {
      await this.prisma.userPermission.createMany({
        data: dto.permissions.map((p) => ({
          userId,
          type: p.type,
          target: p.target,
        })),
      });
    }
    return this.getPermissions(userId);
  }

  /** Check if a user has access to a specific resource */
  async hasResourceAccess(userId: string, resourceId: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) return false;
    // Admin always has full access
    if (user.role === 'admin') return true;
    // Owner always has access to own resources
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      select: { group: true, ownerId: true },
    });
    if (!resource) return false;
    if (resource.ownerId === userId) return true;
    // Check direct resource permission
    const directPerm = await this.prisma.userPermission.findFirst({
      where: { userId, type: 'resource', target: resourceId },
    });
    if (directPerm) return true;
    // Check group permission
    const groupPerm = await this.prisma.userPermission.findFirst({
      where: { userId, type: 'group', target: resource.group },
    });
    return !!groupPerm;
  }

  /** Generate activation token and send activation email */
  async sendActivationEmail(userId: string, baseUrl: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (user.activated) throw new BadRequestException('该用户已激活');
    if (!user.email) throw new BadRequestException('该用户未配置邮箱地址');

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { activationToken: token },
    });

    const activationUrl = `${baseUrl}/activate?token=${token}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Ops Dashboard 账号激活</h2>
        <p>您好，<strong>${user.username}</strong>！</p>
        <p>您的 Ops Dashboard 账号已创建，请点击下方按钮激活账号并设置密码：</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${activationUrl}" style="background: #1677ff; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">激活账号</a>
        </p>
        <p style="color: #666; font-size: 13px;">如果按钮无法点击，请复制以下链接到浏览器打开：</p>
        <p style="color: #666; font-size: 13px; word-break: break-all;">${activationUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px;">此邮件由 Ops Dashboard 系统自动发送，请勿回复。</p>
      </div>
    `;
    const result = await this.mail.sendMail(user.email, '[Ops Dashboard] 账号激活', html);
    if (!result.sent) throw new BadRequestException(`邮件发送失败: ${result.reason}`);
    return { success: true, message: '激活邮件已发送' };
  }

  /** Activate account with token and set password */
  async activateWithToken(token: string, newPassword: string) {
    if (!token) throw new BadRequestException('激活令牌不能为空');
    const user = await this.prisma.adminUser.findFirst({ where: { activationToken: token } });
    if (!user) throw new BadRequestException('激活令牌无效或已过期');
    if (user.activated) throw new BadRequestException('该账号已激活');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: {
        password: hash,
        activated: true,
        activationToken: '',
        mustChangePassword: false,
        mustSetupMfa: true,
        passwordChangedAt: new Date(),
      },
    });
    return { success: true, username: user.username };
  }

  /** Validate activation token (check if it's valid without consuming it) */
  async validateActivationToken(token: string) {
    if (!token) throw new BadRequestException('激活令牌不能为空');
    const user = await this.prisma.adminUser.findFirst({ where: { activationToken: token } });
    if (!user) throw new BadRequestException('激活令牌无效或已过期');
    if (user.activated) throw new BadRequestException('该账号已激活');
    return { valid: true, username: user.username };
  }
}
