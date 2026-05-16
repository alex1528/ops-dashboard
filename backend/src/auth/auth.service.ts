import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { verifySync } from 'otplib';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private crypto: CryptoService,
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
      user: { id: user.id, username: user.username, role: user.role, email: user.email, mfaEnabled: user.mfaEnabled },
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
}
