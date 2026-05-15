import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(userId: string | undefined, action: string, targetId?: string, detail?: string, ip?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          targetId: targetId || null,
          detail: detail || '',
          ip: ip || '',
        },
      });
    } catch (err: any) {
      // Audit log failure must not break the main flow
      this.logger.error(`Failed to write audit log [${action}]: ${err.message}`);
    }
  }
}
