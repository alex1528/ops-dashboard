import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * ForceChangePasswordGuard —— 全局守卫，强制首次登录用户修改初始密码。
 *
 * 职责：
 *  - 当请求未携带有效 JWT（`req.user` 缺失）时直接放行，由其他守卫负责处理；
 *  - 当请求路径命中 {@link ForceChangePasswordGuard.WHITELIST 白名单}（仅四条最小集）时，无条件放行，
 *    保证用户能正常获取自身信息、完成改密与登出；
 *  - 其余情况查询 `AdminUser.mustChangePassword`：
 *      - false → 放行；
 *      - true → 写一条 `auth.force_change_blocked` 审计后抛 `ForbiddenException`，
 *        响应体形如 `{ code: 'MUST_CHANGE_PASSWORD', message: '请先修改初始密码' }`，
 *        前端据此跳转到强制改密页。
 *
 * 白名单使用 method+path 元组的精确匹配（不含 query string），避免出现绕过：
 *  - `GET  /api/auth/me`              查询当前用户信息
 *  - `GET  /api/auth/me/permissions`  查询当前用户权限
 *  - `POST /api/auth/change-password` 提交改密请求
 *  - `POST /api/auth/logout`          登出
 */
@Injectable()
export class ForceChangePasswordGuard implements CanActivate {
  private static readonly WHITELIST: ReadonlyArray<{
    method: string;
    path: string;
  }> = [
    { method: 'GET', path: '/api/auth/me' },
    { method: 'GET', path: '/api/auth/me/permissions' },
    { method: 'POST', path: '/api/auth/change-password' },
    { method: 'POST', path: '/api/auth/logout' },
  ];

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const userPayload = (req as any).user;

    // 未携带 JWT 的请求由其他守卫处理，本守卫直接放行。
    if (!userPayload?.id) {
      return true;
    }

    // 仅取 path，剥离 query 参数，避免影响白名单匹配
    const path = req.originalUrl.split('?')[0];
    const method = req.method.toUpperCase();

    if (
      ForceChangePasswordGuard.WHITELIST.some(
        (w) => w.method === method && path === w.path,
      )
    ) {
      return true;
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: userPayload.id },
      select: { mustChangePassword: true },
    });

    // 用户不存在或无需强制改密，放行
    if (!user || !user.mustChangePassword) {
      return true;
    }

    // 写入审计：detail 字段记录被拦截的路径，便于追溯
    await this.audit.log(
      userPayload.id,
      'auth.force_change_blocked',
      undefined,
      path,
      req.ip,
    );

    throw new ForbiddenException({
      code: 'MUST_CHANGE_PASSWORD',
      message: '请先修改初始密码',
    });
  }
}
