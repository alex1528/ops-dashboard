import { HealthCheckService } from './health-check.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class HealthCheckController {
    private healthCheck;
    private prisma;
    constructor(healthCheck: HealthCheckService, prisma: PrismaService);
    ping(): {
        ok: boolean;
    };
    getStatus(): Promise<{
        id: string;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        healthCheckEnabled: boolean;
        lastHealth: {
            error: string | null;
            id: string;
            checkedAt: Date;
            resourceId: string;
            status: string;
            statusCode: number | null;
            responseMs: number | null;
        } | {
            status: string;
            statusCode: null;
            responseMs: null;
            checkedAt: string;
            skipped: boolean;
        };
    }[]>;
    triggerCheck(id: string): Promise<{
        resourceId: string;
        status: string;
        statusCode: number | null;
        responseMs: number;
        error: string | null;
    } | {
        error: string;
        resourceId?: undefined;
        status?: undefined;
        skipped?: undefined;
    } | {
        resourceId: string;
        status: string;
        skipped: boolean;
        error?: undefined;
    }>;
    getHistory(id: string): Promise<{
        error: string | null;
        id: string;
        checkedAt: Date;
        resourceId: string;
        status: string;
        statusCode: number | null;
        responseMs: number | null;
    }[]>;
}
