import { OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { LoginAdapter, AuthResult } from './adapters/login-adapter.interface';
import { PocketBaseAdapter } from './adapters/pocketbase.adapter';
import { CertdAdapter } from './adapters/certd.adapter';
import { GenericFormAdapter } from './adapters/generic-form.adapter';
export declare class ProxyService implements OnModuleDestroy {
    private prisma;
    private crypto;
    private readonly logger;
    private readonly adapters;
    private readonly sessionCache;
    private readonly cacheCleanupTimer;
    private readonly modeToAdapter;
    constructor(prisma: PrismaService, crypto: CryptoService, pocketbase: PocketBaseAdapter, certd: CertdAdapter, genericForm: GenericFormAdapter);
    onModuleDestroy(): void;
    getSession(resourceId: string): Promise<{
        authResult: AuthResult;
        adapter: LoginAdapter;
        targetUrl: string;
    } | null>;
    clearSession(resourceId: string): void;
    getPreFillData(resourceId: string): Promise<{
        targetUrl: string;
        username: string;
        password: string;
    } | null>;
    private detectAdapter;
}
