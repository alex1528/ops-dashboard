import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto } from './change-password.dto';
import { verifySync } from 'otplib';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private crypto: CryptoService,
    private audit: AuditService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(username: string, password: string, mfaCode?: string) {
    const user = await this.validateUser(username, password);

    // MFA verification
    if (user.mfaEnabled && user.mfaSecret) {
      if (!mfaCode) {
        return { mfaRequired: true, message: '请输入 MFA 验证码' };
      }
      // Decrypt mfaSecret (supports both encrypted and legacy plaintext values)
      const secret = this.decryptMfaSecret(user.mfaSecret);
      const valid = verifySync({ token: mfaCode, secret });
      if (!valid) throw new BadRequestException('MFA 验证码错误');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Decrypt a stored MFA secret. Supports legacy plaintext values stored before
   * encryption was introduced (identified via the iv:tag:ciphertext hex pattern).
   */
  private decryptMfaSecret(secret: string): string {
    if (!secret) return '';
    const parts = secret.split(':');
    const isEncrypted =
      parts.length === 3 &&
      parts[0].length === 24 &&
      parts[1].length === 32 &&
      parts.every((p) => p.length > 0 && /^[0-9a-f]+$/i.test(p));
    return isEncrypted ? this.crypto.decrypt(secret) : secret;
  }

  /**
   * 校验新密码强度：长度至少 8 位，且必须同时包含字母与数字。
   * 错误信息使用与前端一致的中文文案，且不包含密码原文。
   */
  private assertPasswordStrength(pw: string) {
    if (pw.length < 8) {
      throw new BadRequestException('新密码长度不能少于 8 位');
    }
    const hasLetter = /[A-Za-z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    if (!hasLetter || !hasDigit) {
      throw new BadRequestException('新密码必须同时包含字母与数字');
    }
  }

  /**
   * 修改当前登录用户的密码。
   *
   * 流程：校验原密码 → 校验新旧不同 → 校验强度 → bcrypt(12) 哈希 →
   * 更新 password / mustChangePassword=false / passwordChangedAt → 写审计 → 返回成功。
   *
   * 任何错误响应都不会回显 oldPassword / newPassword 明文，审计 detail 也保持为空字符串。
   */
  async changePassword(userId: string, dto: ChangePasswordDto, ip: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) throw new BadRequestException('原密码错误');

    if (dto.newPassword === dto.oldPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }

    this.assertPasswordStrength(dto.newPassword);

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        password: hash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    await this.audit.log(userId, 'user.change_password', userId, '', ip);

    return { success: true };
  }
}
