import { OnModuleDestroy } from '@nestjs/common';
export interface ProxySessionInfo {
    userId: string;
    resourceId: string;
    expiresAt: number;
}
export declare class ProxySessionStore implements OnModuleDestroy {
    private sessions;
    private cleanupTimer;
    constructor();
    onModuleDestroy(): void;
    create(userId: string, resourceId: string, ttlMs?: number): string;
    validate(token: string): ProxySessionInfo | null;
    private cleanup;
}
