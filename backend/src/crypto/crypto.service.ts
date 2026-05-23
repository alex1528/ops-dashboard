import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.MASTER_KEY;
    // 详细分级诊断，帮助定位最常见的部署失误。错误信息只引用变量名，
    // 不会回显密钥本身（即便它被错填）。
    if (!hex) {
      throw new Error(
        'MASTER_KEY 未设置。Docker Compose 部署请在仓库根目录 .env 中配置；' +
          '本地开发请在 backend/.env 中配置。生成方法：openssl rand -hex 32',
      );
    }
    if (hex.includes('CHANGE_ME')) {
      throw new Error(
        'MASTER_KEY 仍为占位符（包含 CHANGE_ME），请替换为真实的 64 位 hex。' +
          '生成方法：openssl rand -hex 32',
      );
    }
    if (hex.length !== 64) {
      throw new Error(
        `MASTER_KEY 长度应为 64 位 hex（当前长度 ${hex.length}）。` +
          '生成方法：openssl rand -hex 32',
      );
    }
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error(
        'MASTER_KEY 必须是 64 位 hex 字符串（仅允许 0-9 / a-f）。' +
          '生成方法：openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // format: iv:tag:ciphertext (all hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(token: string): string {
    const parts = token.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
