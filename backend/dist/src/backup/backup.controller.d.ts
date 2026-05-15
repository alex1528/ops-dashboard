import { BackupService } from './backup.service';
export declare class BackupController {
    private readonly backupService;
    constructor(backupService: BackupService);
    triggerBackup(): Promise<{
        ok: boolean;
        path: string;
        skipped: boolean;
    }>;
}
