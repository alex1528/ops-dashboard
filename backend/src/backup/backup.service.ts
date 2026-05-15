import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const BACKUP_CRON = process.env.BACKUP_CRON ?? '0 3 * * *';
const BACKUP_FILE = 'ops-dashboard-backup.db';

@Injectable()
export class BackupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupService.name);
  private readonly enabled: boolean;
  private readonly backupDir: string;
  private readonly dbFile: string;

  constructor(private readonly prisma: PrismaService) {
    this.enabled = process.env.BACKUP_ENABLED !== 'false';

    const dbUrl = process.env.DATABASE_URL ?? 'file:./data/ops-dashboard.db';
    const dbPath = dbUrl.replace(/^file:/, '');
    this.dbFile = path.resolve(process.cwd(), dbPath);

    this.backupDir = process.env.BACKUP_DIR
      ? path.resolve(process.env.BACKUP_DIR)
      : path.resolve(path.dirname(this.dbFile), '..', 'backup');
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Backup disabled (BACKUP_ENABLED=false)');
      return;
    }
    try {
      fs.mkdirSync(this.backupDir, { recursive: true });
      this.logger.log(
        `Backup service ready — dir: ${this.backupDir}, file: ${BACKUP_FILE}, cron: ${BACKUP_CRON}`,
      );
    } catch (err) {
      this.logger.warn(`Failed to create backup directory: ${err}`);
    }
  }

  @Cron(BACKUP_CRON)
  async scheduledBackup(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.backupNow();
    } catch (err) {
      this.logger.error(`Scheduled backup failed: ${err}`);
    }
  }

  /**
   * Incremental backup: only overwrites the single backup file when the
   * source database has actually changed (compared via SHA-256 hash).
   * Uses SQLite `VACUUM INTO` for a live, consistent hot-backup.
   * Returns the backup file path, or null if skipped (no changes).
   */
  async backupNow(force = false): Promise<{ path: string; skipped: boolean }> {
    fs.mkdirSync(this.backupDir, { recursive: true });

    const destFile = path.join(this.backupDir, BACKUP_FILE);
    const tempFile = destFile + '.tmp';

    // Step 1: create a temporary VACUUM copy
    const safePath = tempFile.replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(`VACUUM INTO '${safePath}'`);

    // Step 2: compare hashes for incremental logic
    if (!force && fs.existsSync(destFile)) {
      const oldHash = this.fileHash(destFile);
      const newHash = this.fileHash(tempFile);
      if (oldHash === newHash) {
        fs.unlinkSync(tempFile);
        this.logger.log('Backup skipped — database unchanged');
        return { path: destFile, skipped: true };
      }
    }

    // Step 3: atomically replace
    fs.renameSync(tempFile, destFile);
    this.logger.log(`Backup complete: ${destFile}`);
    return { path: destFile, skipped: false };
  }

  private fileHash(filePath: string): string {
    const hash = crypto.createHash('sha256');
    const buf = fs.readFileSync(filePath);
    hash.update(buf);
    return hash.digest('hex');
  }
}
