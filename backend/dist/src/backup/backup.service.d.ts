import { OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare class BackupService implements OnApplicationBootstrap {
    private readonly prisma;
    private readonly logger;
    private readonly enabled;
    private readonly backupDir;
    private readonly dbFile;
    constructor(prisma: PrismaService);
    onApplicationBootstrap(): Promise<void>;
    scheduledBackup(): Promise<void>;
    backupNow(force?: boolean): Promise<{
        path: string;
        skipped: boolean;
    }>;
    private fileHash;
}
