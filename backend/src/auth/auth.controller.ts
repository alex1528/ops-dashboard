import { Controller, Post, Get, Body, UseGuards, Req, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto } from './change-password.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from '../system/system.service';
import { IsNotEmpty, IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import * as bcrypt from 'bcrypt';

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

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private systemService: SystemService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password, dto.mfaCode);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
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
    await this.prisma.adminUser.create({
      data: {
        username: dto.username,
        password: hash,
        email: dto.email || '',
        role,
        // 自助注册的用户由用户本人输入密码，无需被强制改密
        mustChangePassword: false,
      },
    });

    // Auto-login after registration
    return this.auth.login(dto.username, dto.password);
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
}
