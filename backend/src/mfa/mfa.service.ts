import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class MfaService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  /** Generate a new TOTP secret and QR code for binding */
  async generateSetup(userId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (user.mfaEnabled) throw new BadRequestException('MFA 已启用，请先禁用后再重新绑定');

    const secret = generateSecret();
    const otpAuthUrl = generateURI({
      secret,
      issuer: 'OpsDashboard',
      label: user.username,
    });
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store secret temporarily (not yet enabled until verified)
    // Secret is encrypted at rest; looksEncrypted() in decryptMfaSecret handles
    // forward-compat for any legacy plaintext values already in the DB.
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { mfaSecret: this.crypto.encrypt(secret) },
    });

    return { secret, qrDataUrl, otpAuthUrl };
  }

  /** Verify code and enable MFA */
  async verifyAndEnable(userId: string, code: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!user.mfaSecret) throw new BadRequestException('请先生成 MFA 密钥');
    if (user.mfaEnabled) throw new BadRequestException('MFA 已启用');

    const valid = verifySync({ token: code, secret: this.decryptMfaSecret(user.mfaSecret) });
    if (!valid) throw new BadRequestException('验证码错误，请检查后重试');

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { mfaEnabled: true, mustSetupMfa: false },
    });

    return { enabled: true };
  }

  /** Disable MFA for the current user */
  async disable(userId: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!user.mfaEnabled) throw new BadRequestException('MFA 未启用');

    // Require password verification to disable MFA
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new BadRequestException('密码错误');

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: '' },
    });

    return { enabled: false };
  }

  /** Get MFA status for current user */
  async getStatus(userId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return { mfaEnabled: user.mfaEnabled };
  }

  /**
   * Decrypt a stored MFA secret with backward-compat for legacy plaintext.
   * Old records written before encryption was added are returned as-is.
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
