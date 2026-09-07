import { Controller, Post, Get, Body, Query, UseGuards, Req, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto } from './change-password.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from '../system/system.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { IsNotEmpty, IsString, IsOptional, IsEmail, MaxLength, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

class LoginDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsString() @IsOptional() mfaCode?: string;
}

class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(50) username!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
  @IsOptional() @IsEmail() email?: string;
}

class ActivateDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsString() @IsNotEmpty() @MinLength(8) @MaxLength(200) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private systemService: SystemService,
    private usersService: UsersService,
    private mail: MailService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password, dto.mfaCode);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const userCount = await this.prisma.adminUser.count();
    const isFirstUser = userCount === 0;

    // If not the first user, check allow_registration setting
    if (!isFirstUser) {
      const allowed = await this.systemService.getSetting('allow_registration');
      if (allowed !== 'true') {
        throw new ForbiddenException('系统未开放注册');
      }
    }

    // Check username uniqueness
    const existing = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
    if (existing) throw new ConflictException('用户名已存在');

    let role = 'user';

    if (isFirstUser) {
      // First user registration — check .env compatibility
      const envUsername = process.env.ADMIN_USERNAME;
      const envPassword = process.env.ADMIN_PASSWORD;

      if (envUsername && envPassword) {
        // .env has admin credentials configured — must match to become admin
        if (dto.username !== envUsername || dto.password !== envPassword) {
          throw new BadRequestException('系统要求使用预设管理员账号完成首次注册');
        }
      }
      // Either .env matched or .env not configured — first user becomes admin
      role = 'admin';
    }

    const hash = await bcrypt.hash(dto.password, 12);
    const activationToken = crypto.randomBytes(32).toString('hex');
    const user = await this.prisma.adminUser.create({
      data: {
        username: dto.username,
        password: hash,
        email: dto.email || '',
        role,
        activated: isFirstUser,
        activationToken: isFirstUser ? '' : activationToken,
        mustChangePassword: false,
        mustSetupMfa: !isFirstUser,
      },
    });

    // First user (admin) auto-login without activation
    if (isFirstUser) {
      return this.auth.login(dto.username, dto.password);
    }

    // Send activation email if email is provided and SMTP is configured
    if (dto.email && this.mail.isConfigured) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${proto}://${host}`;
      const activationUrl = `${baseUrl}/activate?token=${activationToken}`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ops Dashboard 账号激活</h2>
          <p>您好，<strong>${dto.username}</strong>！</p>
          <p>感谢您注册 Ops Dashboard，请点击下方按钮激活账号：</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${activationUrl}" style="background: #1677ff; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">激活账号</a>
          </p>
          <p style="color: #666; font-size: 13px;">如果按钮无法点击，请复制以下链接到浏览器打开：</p>
          <p style="color: #666; font-size: 13px; word-break: break-all;">${activationUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">此邮件由 Ops Dashboard 系统自动发送，请勿回复。</p>
        </div>
      `;
      await this.mail.sendMail(dto.email, '[Ops Dashboard] 账号激活', html);
    }

    return { success: true, message: '注册成功，请查收激活邮件完成账号激活', needActivation: true };
  }

  /**
   * 修改当前登录用户密码。
   *
   * 仅校验 JWT 后即可访问；该路由位于 `ForceChangePasswordGuard` 白名单中，
   * 因此处于 `mustChangePassword=true` 状态的用户也能调用此接口完成首次改密。
   * 业务校验、审计与字段更新统一委托 `AuthService.changePassword`，
   * 控制器只负责注入 `userId` 与请求 IP。
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const u = (req as any).user;
    return this.auth.changePassword(u.id, dto, req.ip ?? '');
  }

  /** Used by the frontend to verify a stored token is still valid */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const u = (req as any).user;
    const user = await this.prisma.adminUser.findUnique({ where: { id: u.id } });
    if (!user) return u;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      mustSetupMfa: user.mustSetupMfa,
    };
  }

  /** Return current user's resource permissions */
  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  async mePermissions(@Req() req: Request) {
    const u = (req as any).user;
    const user = await this.prisma.adminUser.findUnique({ where: { id: u.id } });
    if (!user) return { role: 'user', permissions: [] };
    if (user.role === 'admin') return { role: 'admin', permissions: [] };
    const permissions = await this.prisma.userPermission.findMany({
      where: { userId: user.id },
      select: { type: true, target: true },
    });
    return { role: user.role, permissions };
  }

  /** 验证激活令牌是否有效（公开接口，无需认证） */
  @Get('activate-check')
  async activateCheck(@Query('token') token: string) {
    if (!token) throw new BadRequestException('缺少激活令牌');
    return this.usersService.validateActivationToken(token);
  }

  /** 用户通过激活链接设置密码并激活账号（公开接口，无需认证） */
  @Post('activate')
  async activate(@Body() dto: ActivateDto) {
    return this.usersService.activateWithToken(dto.token, dto.password);
  }
}
