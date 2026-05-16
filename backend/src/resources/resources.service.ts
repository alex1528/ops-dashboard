import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { CreateResourceDto, UpdateResourceDto } from './resources.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async findAll() {
    const resources = await this.prisma.resource.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        credential: true,
        healthRecords: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
        },
      },
    });

    return resources.map((r) => ({
      ...r,
      credential: r.credential
        ? {
            id: r.credential.id,
            username: '••••••',
            hasPassword: !!r.credential.password,
            hasExtra: !!r.credential.extra && r.credential.extra !== '',
          }
        : null,
      lastHealth: r.healthRecords[0] || null,
      healthRecords: undefined,
    }));
  }

  async findOne(id: string) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        credential: true,
        healthRecords: { orderBy: { checkedAt: 'desc' }, take: 10 },
      },
    });
    if (!r) throw new NotFoundException();
    return {
      ...r,
      credential: r.credential
        ? {
            id: r.credential.id,
            username: '••••••',
            hasPassword: !!r.credential.password,
            hasExtra: !!r.credential.extra && r.credential.extra !== '',
          }
        : null,
    };
  }

  async getDecryptedCredential(resourceId: string) {
    const cred = await this.prisma.credential.findUnique({ where: { resourceId } });
    if (!cred) return { exists: false, username: '', password: '', extra: '' };
    try {
      return {
        exists: true,
        username: this.decryptStoredCredential(cred.username),
        password: this.decryptStoredCredential(cred.password),
        extra: cred.extra ? this.decryptStoredCredential(cred.extra) : '',
      };
    } catch (err) {
      throw new Error(`凭据解密失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private decryptStoredCredential(value: string) {
    if (!value) return '';
    if (!this.looksEncrypted(value)) return value;
    return this.crypto.decrypt(value);
  }

  private looksEncrypted(value: string) {
    const parts = value.split(':');
    return parts.length === 3
      && parts[0].length === 24
      && parts[1].length === 32
      && parts.every((part) => part.length > 0 && /^[0-9a-f]+$/i.test(part));
  }

  async create(dto: CreateResourceDto) {
    const { credUsername, credPassword, credExtra, ...resourceData } = dto;
    const resource = await this.prisma.resource.create({ data: resourceData });

    if (credUsername || credPassword) {
      await this.prisma.credential.create({
        data: {
          resourceId: resource.id,
          username: this.crypto.encrypt(credUsername || ''),
          password: this.crypto.encrypt(credPassword || ''),
          extra: credExtra ? this.crypto.encrypt(credExtra) : '',
        },
      });
    }
    return this.findOne(resource.id);
  }

  async update(id: string, dto: UpdateResourceDto) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    const { credUsername, credPassword, credExtra, ...resourceData } = dto;
    await this.prisma.resource.update({ where: { id }, data: resourceData });

    if (credUsername !== undefined || credPassword !== undefined || credExtra !== undefined) {
      const credData: any = {};
      if (credUsername !== undefined) credData.username = this.crypto.encrypt(credUsername);
      if (credPassword !== undefined) credData.password = this.crypto.encrypt(credPassword);
      if (credExtra !== undefined) credData.extra = this.crypto.encrypt(credExtra);

      const existingCred = await this.prisma.credential.findUnique({ where: { resourceId: id } });
      if (existingCred) {
        await this.prisma.credential.update({ where: { resourceId: id }, data: credData });
      } else if (credUsername || credPassword) {
        await this.prisma.credential.create({
          data: {
            resourceId: id,
            username: credData.username ?? this.crypto.encrypt(''),
            password: credData.password ?? this.crypto.encrypt(''),
            extra: credData.extra ?? '',
          },
        });
      }
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.resource.delete({ where: { id } });
    return { deleted: true };
  }
}
