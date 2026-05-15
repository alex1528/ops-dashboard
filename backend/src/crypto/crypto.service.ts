import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.MASTER_KEY;
    if (!hex || hex.length !== 64 || hex.includes('CHANGE_ME')) {
      throw new Error('MASTER_KEY must be a 64-char hex string. Generate with: openssl rand -hex 32');
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
