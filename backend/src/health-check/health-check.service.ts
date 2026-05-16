import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAll() {
    const resources = await this.prisma.resource.findMany({ where: { enabled: true } });
    const timeoutMs = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '10000', 10);

    for (const resource of resources) {
      if (!resource.healthCheckEnabled) continue;
      await this.checkOne(resource.id, resource.url, timeoutMs);
    }
  }

  async checkOne(resourceId: string, url: string, timeoutMs = 10000) {
    let status = 'unknown';
    let statusCode: number | null = null;
    let error: string | null = null;
    let responseMs = 0;

    // Retry once to reduce false positives from transient network blips
    // responseMs measures the last attempt's actual HTTP round-trip only,
    // NOT including the 2-second inter-attempt delay.
    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptStart = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);
        statusCode = res.status;
        status = res.ok ? 'up' : 'down';
        error = null;
        responseMs = Date.now() - attemptStart;
        break; // success — no need to retry
      } catch (err: any) {
        responseMs = Date.now() - attemptStart;
        status = 'down';
        error = err.message?.substring(0, 500) || 'Unknown error';
        if (attempt === 0) {
          // Brief pause before retry
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    await this.prisma.healthRecord.create({
      data: { resourceId, status, statusCode, responseMs, error },
    });

    // Keep only last 100 records per resource
    const records = await this.prisma.healthRecord.findMany({
      where: { resourceId },
      orderBy: { checkedAt: 'desc' },
      skip: 100,
      select: { id: true },
    });
    if (records.length > 0) {
      await this.prisma.healthRecord.deleteMany({
        where: { id: { in: records.map((r) => r.id) } },
      });
    }

    return { resourceId, status, statusCode, responseMs, error };
  }

  async getHistory(resourceId: string, limit = 20) {
    return this.prisma.healthRecord.findMany({
      where: { resourceId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
  }
}
