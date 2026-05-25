import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ForceMfaGuard —— 全局守卫，强制用户在改密完成后绑定 MFA。
 *
 * 执行顺序：排在 ForceChangePasswordGuard 之后。
 * 逻辑：
 *  - 当 mustChangePassword === false 且 mfaEnabled === false 且 mustSetupMfa === true 时拦截；
 *  - 白名单：/api/auth/me, /api/auth/logout, /api/mfa/setup, /api/mfa/verify, /api/auth/me/permissions
 *  - 拦截时返回 403 { code: 'MUST_SETUP_MFA', message: '请先绑定 MFA 两步验证' }
 */
@Injectable()
export class ForceMfaGuard implements CanActivate {
  private static readonly WHITELIST: ReadonlyArray<{
    method: string;
    path: string;
  }> = [
    { method: 'GET', path: '/api/auth/me' },
    { method: 'GET', path: '/api/auth/me/permissions' },
    { method: 'POST', path: '/api/auth/logout' },
    { method: 'POST', path: '/api/mfa/setup' },
    { method: 'POST', path: '/api/mfa/verify' },
  ];

  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const userPayload = (req as any).user;

    if (!userPayload?.id) {
      return true;
    }

    const path = req.originalUrl.split('?')[0];
    const method = req.method.toUpperCase();

    if (
      ForceMfaGuard.WHITELIST.some(
        (w) => w.method === method && path === w.path,
      )
    ) {
      return true;
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: userPayload.id },
      select: { mustChangePassword: true, mfaEnabled: true, mustSetupMfa: true },
    });

    // 用户不存在、仍需改密（由上一个 guard 处理）、已启用 MFA 或不强制设置 → 放行
    if (!user || user.mustChangePassword || user.mfaEnabled || !user.mustSetupMfa) {
      return true;
    }

    throw new ForbiddenException({
      code: 'MUST_SETUP_MFA',
      message: '请先绑定 MFA 两步验证',
    });
  }
}
