import { Controller, Get, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HealthCheckService } from './health-check.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthCheckController {
  constructor(
    private healthCheck: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  /** Lightweight liveness probe for Docker healthcheck — no DB query needed */
  @Get('ping')
  ping() {
    return { ok: true };
  }

  /** Public endpoint: dashboard overview (no auth needed for read-only status) */
  @Get('status')
  async getStatus() {
    const resources = await this.prisma.resource.findMany({
      where: { enabled: true },
      orderBy: [{ groupSortOrder: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        healthRecords: { orderBy: { checkedAt: 'desc' }, take: 1 },
        credential: { select: { privateKey: true, sshEnabled: true } },
      },
    });

    return resources.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      group: r.group,
      subGroup: r.subGroup,
      groupSortOrder: r.groupSortOrder,
      sortOrder: r.sortOrder,
      description: r.description,
      healthCheckEnabled: r.healthCheckEnabled,
      ownerId: r.ownerId,
      hasPrivateKey: !!(r.credential?.privateKey && r.credential.privateKey !== ''),
      sshEnabled: r.credential?.sshEnabled ?? false,
      hasCredential: !!r.credential,
      lastHealth: r.healthCheckEnabled
        ? (r.healthRecords[0] || null)
        : { status: 'up', statusCode: null, responseMs: null, checkedAt: new Date().toISOString(), skipped: true },
    }));
  }

  @Post(':id/check')
  @UseGuards(JwtAuthGuard)
  async triggerCheck(@Param('id') id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (!resource.healthCheckEnabled) return { resourceId: id, status: 'up', skipped: true };
    return this.healthCheck.checkOne(resource.id, resource.url);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Param('id') id: string) {
    return this.healthCheck.getHistory(id);
  }
}
