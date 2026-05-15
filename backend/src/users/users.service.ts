import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './users.dto';

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
    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true };
  }
}
