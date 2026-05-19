import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto, UpdateUserPermissionsDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async findOne(id: string) {
    const u = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
    if (exists) throw new ConflictException('用户名已存在');
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.adminUser.create({
      data: {
        username: dto.username,
        password: hash,
        email: dto.email || '',
        role: dto.role || 'user',
      },
    });
    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (dto.password) data.password = await bcrypt.hash(dto.password, 12);
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    // Admin can force-disable MFA for a user
    if (dto.mfaEnabled === false) {
      data.mfaEnabled = false;
      data.mfaSecret = '';
    }
    await this.prisma.adminUser.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    // Prevent deleting the last admin user — would lock out the system
    if (existing.role === 'admin') {
      const adminCount = await this.prisma.adminUser.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('不能删除系统中最后一个管理员账号');
      }
    }
    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true };
  }

  /** Get permissions for a user */
  async getPermissions(userId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const permissions = await this.prisma.userPermission.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return permissions.map((p) => ({ id: p.id, type: p.type, target: p.target }));
  }

  /** Replace all permissions for a user */
  async updatePermissions(userId: string, dto: UpdateUserPermissionsDto) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    // Delete existing permissions and recreate
    await this.prisma.userPermission.deleteMany({ where: { userId } });
    if (dto.permissions.length > 0) {
      await this.prisma.userPermission.createMany({
        data: dto.permissions.map((p) => ({
          userId,
          type: p.type,
          target: p.target,
        })),
      });
    }
    return this.getPermissions(userId);
  }

  /** Check if a user has access to a specific resource */
  async hasResourceAccess(userId: string, resourceId: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) return false;
    // Admin always has full access
    if (user.role === 'admin') return true;
    // Owner always has access to own resources
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      select: { group: true, ownerId: true },
    });
    if (!resource) return false;
    if (resource.ownerId === userId) return true;
    // Check direct resource permission
    const directPerm = await this.prisma.userPermission.findFirst({
      where: { userId, type: 'resource', target: resourceId },
    });
    if (directPerm) return true;
    // Check group permission
    const groupPerm = await this.prisma.userPermission.findFirst({
      where: { userId, type: 'group', target: resource.group },
    });
    return !!groupPerm;
  }
}
