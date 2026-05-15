import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupService } from './backup.service';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /** Manual trigger — requires admin login */
  @UseGuards(JwtAuthGuard)
  @Post()
  async triggerBackup() {
    const result = await this.backupService.backupNow(true);
    return { ok: true, path: result.path, skipped: result.skipped };
  }
}
