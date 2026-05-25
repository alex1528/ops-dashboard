import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { CreateResourceDto, UpdateResourceDto, ReorderGroupsDto, ReorderResourcesDto, ClearCredentialFieldsDto } from './resources.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async findAll() {
    const resources = await this.prisma.resource.findMany({
      orderBy: [{ groupSortOrder: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
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
            hasPrivateKey: !!r.credential.privateKey && r.credential.privateKey !== '',
            sshEnabled: r.credential.sshEnabled,
          }
        : null,
      hasCredential: !!r.credential,
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
            hasPrivateKey: !!r.credential.privateKey && r.credential.privateKey !== '',
            sshEnabled: r.credential.sshEnabled,
          }
        : null,
      hasCredential: !!r.credential,
    };
  }

  async getDecryptedCredential(resourceId: string) {
    const cred = await this.prisma.credential.findUnique({ where: { resourceId } });
    if (!cred) return { exists: false, username: '', password: '', extra: '', privateKey: '', sshEnabled: false };
    try {
      return {
        exists: true,
        username: this.decryptStoredCredential(cred.username),
        password: this.decryptStoredCredential(cred.password),
        extra: cred.extra ? this.decryptStoredCredential(cred.extra) : '',
        privateKey: cred.privateKey ? this.decryptStoredCredential(cred.privateKey) : '',
        sshEnabled: cred.sshEnabled,
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
      && /^[0-9a-f]+$/i.test(parts[0])
      && parts[1].length === 32
      && /^[0-9a-f]+$/i.test(parts[1])
      && (parts[2] === '' || /^[0-9a-f]+$/i.test(parts[2]));
  }

  async create(dto: CreateResourceDto, ownerId?: string | null) {
    const { credUsername, credPassword, credExtra, credPrivateKey, credSshEnabled, ...resourceData } = dto;
    const resource = await this.prisma.resource.create({
      data: { ...resourceData, ownerId: ownerId ?? null },
    });

    if (credUsername || credPassword || credPrivateKey || credSshEnabled) {
      await this.prisma.credential.create({
        data: {
          resourceId: resource.id,
          username: this.crypto.encrypt(credUsername || ''),
          password: this.crypto.encrypt(credPassword || ''),
          extra: credExtra ? this.crypto.encrypt(credExtra) : '',
          privateKey: credPrivateKey ? this.crypto.encrypt(credPrivateKey) : '',
          sshEnabled: credSshEnabled ?? false,
        },
      });
    }
    return this.findOne(resource.id);
  }

  async update(id: string, dto: UpdateResourceDto) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    const { credUsername, credPassword, credExtra, credPrivateKey, credSshEnabled, ...resourceData } = dto;
    await this.prisma.resource.update({ where: { id }, data: resourceData });

    if (credUsername !== undefined || credPassword !== undefined || credExtra !== undefined || credPrivateKey !== undefined || credSshEnabled !== undefined) {
      const credData: any = {};
      if (credUsername !== undefined) credData.username = this.crypto.encrypt(credUsername);
      if (credPassword !== undefined) credData.password = this.crypto.encrypt(credPassword);
      if (credExtra !== undefined) credData.extra = this.crypto.encrypt(credExtra);
      if (credPrivateKey !== undefined) credData.privateKey = credPrivateKey ? this.crypto.encrypt(credPrivateKey) : '';
      if (credSshEnabled !== undefined) credData.sshEnabled = credSshEnabled;

      const existingCred = await this.prisma.credential.findUnique({ where: { resourceId: id } });
      if (existingCred) {
        await this.prisma.credential.update({ where: { resourceId: id }, data: credData });
      } else if (credUsername || credPassword || credPrivateKey || credSshEnabled) {
        await this.prisma.credential.create({
          data: {
            resourceId: id,
            username: credData.username ?? this.crypto.encrypt(''),
            password: credData.password ?? this.crypto.encrypt(''),
            extra: credData.extra ?? '',
            privateKey: credData.privateKey ?? '',
            sshEnabled: credSshEnabled ?? false,
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

  /**
   * 批量更新分组排序：将同一 group 下所有资源的 groupSortOrder 设为指定值
   */
  async reorderGroups(dto: ReorderGroupsDto) {
    const ops = dto.groups.map((g) =>
      this.prisma.resource.updateMany({
        where: { group: g.group },
        data: { groupSortOrder: g.sortOrder },
      }),
    );
    await this.prisma.$transaction(ops);
    return { success: true };
  }

  /**
   * 批量更新资源排序：逐个更新指定资源的 sortOrder
   */
  async reorderResources(dto: ReorderResourcesDto) {
    const ops = dto.items.map((item) =>
      this.prisma.resource.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    );
    await this.prisma.$transaction(ops);
    return { success: true };
  }

  /**
   * 清空指定资源的凭据字段（将对应字段设为加密空字符串）
   */
  async clearCredentialFields(resourceId: string, dto: ClearCredentialFieldsDto) {
    const existing = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!existing) throw new NotFoundException();

    const cred = await this.prisma.credential.findUnique({ where: { resourceId } });
    if (!cred) throw new NotFoundException('该资源未配置凭据');

    const emptyEncrypted = this.crypto.encrypt('');
    const updateData: Record<string, string> = {};

    if (dto.field === 'username' || dto.field === 'all') {
      updateData.username = emptyEncrypted;
    }
    if (dto.field === 'password' || dto.field === 'all') {
      updateData.password = emptyEncrypted;
    }
    if (dto.field === 'extra' || dto.field === 'all') {
      updateData.extra = emptyEncrypted;
    }
    if (dto.field === 'privateKey' || dto.field === 'all') {
      updateData.privateKey = '';
    }

    await this.prisma.credential.update({
      where: { resourceId },
      data: updateData,
    });

    const clearedFields = dto.field === 'all' ? 'username, password, extra, privateKey' : dto.field;
    return { success: true, cleared: clearedFields, resourceName: existing.name };
  }

  /**
   * 获取所有已使用的分组和子分组（去重），供前端 AutoComplete 数据源使用
   */
  async getGroups() {
    const resources = await this.prisma.resource.findMany({
      select: { group: true, subGroup: true },
    });
    const groupSet = new Set<string>();
    const subGroupMap = new Map<string, Set<string>>();
    for (const r of resources) {
      groupSet.add(r.group);
      if (!subGroupMap.has(r.group)) subGroupMap.set(r.group, new Set());
      if (r.subGroup) subGroupMap.get(r.group)!.add(r.subGroup);
    }
    const groups = Array.from(groupSet).sort();
    const subGroups: Record<string, string[]> = {};
    for (const [g, subs] of subGroupMap) {
      subGroups[g] = Array.from(subs).sort();
    }
    return { groups, subGroups };
  }
}
