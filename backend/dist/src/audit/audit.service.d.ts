import { PrismaService } from '../prisma/prisma.service';
export declare class AuditService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    log(userId: string | undefined, action: string, targetId?: string, detail?: string, ip?: string): Promise<void>;
}
