import { PrismaService } from '../prisma/prisma.service';
export declare class HealthCheckService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    checkAll(): Promise<void>;
    checkOne(resourceId: string, url: string, timeoutMs?: number): Promise<{
        resourceId: string;
        status: string;
        statusCode: number | null;
        responseMs: number;
        error: string | null;
    }>;
    getHistory(resourceId: string, limit?: number): Promise<{
        error: string | null;
        id: string;
        checkedAt: Date;
        resourceId: string;
        status: string;
        statusCode: number | null;
        responseMs: number | null;
    }[]>;
}
