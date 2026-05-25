import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ForceChangePasswordGuard } from './force-change-password.guard';
import { ForceMfaGuard } from './force-mfa.guard';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any },
    }),
    SystemModule,
    // PrismaModule 与 AuditModule 都已声明为 @Global()，无需在此显式导入；
    // ForceChangePasswordGuard / AuthService 等可直接注入对应 Service。
  ],
  providers: [
    AuthService,
    JwtStrategy,
    // 全局注册首次登录强制改密守卫，对所有路由生效；具体放行规则由 Guard 内部白名单
    // （/auth/me、/auth/me/permissions、/auth/change-password、/auth/logout）控制。
    { provide: APP_GUARD, useClass: ForceChangePasswordGuard },
    // 改密完成后强制绑定 MFA 守卫（排在 ForceChangePasswordGuard 之后）
    { provide: APP_GUARD, useClass: ForceMfaGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
