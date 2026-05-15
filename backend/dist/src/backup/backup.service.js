"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BackupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const BACKUP_CRON = process.env.BACKUP_CRON ?? '0 3 * * *';
const BACKUP_FILE = 'ops-dashboard-backup.db';
let BackupService = BackupService_1 = class BackupService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(BackupService_1.name);
        this.enabled = process.env.BACKUP_ENABLED !== 'false';
        const dbUrl = process.env.DATABASE_URL ?? 'file:./data/ops-dashboard.db';
        const dbPath = dbUrl.replace(/^file:/, '');
        this.dbFile = path.resolve(process.cwd(), dbPath);
        this.backupDir = process.env.BACKUP_DIR
            ? path.resolve(process.env.BACKUP_DIR)
            : path.resolve(path.dirname(this.dbFile), '..', 'backup');
    }
    async onApplicationBootstrap() {
        if (!this.enabled) {
            this.logger.log('Backup disabled (BACKUP_ENABLED=false)');
            return;
        }
        try {
            fs.mkdirSync(this.backupDir, { recursive: true });
            this.logger.log(`Backup service ready — dir: ${this.backupDir}, file: ${BACKUP_FILE}, cron: ${BACKUP_CRON}`);
        }
        catch (err) {
            this.logger.warn(`Failed to create backup directory: ${err}`);
        }
    }
    async scheduledBackup() {
        if (!this.enabled)
            return;
        try {
            await this.backupNow();
        }
        catch (err) {
            this.logger.error(`Scheduled backup failed: ${err}`);
        }
    }
    async backupNow(force = false) {
        fs.mkdirSync(this.backupDir, { recursive: true });
        const destFile = path.join(this.backupDir, BACKUP_FILE);
        const tempFile = destFile + '.tmp';
        const safePath = tempFile.replace(/'/g, "''");
        await this.prisma.$executeRawUnsafe(`VACUUM INTO '${safePath}'`);
        if (!force && fs.existsSync(destFile)) {
            const oldHash = this.fileHash(destFile);
            const newHash = this.fileHash(tempFile);
            if (oldHash === newHash) {
                fs.unlinkSync(tempFile);
                this.logger.log('Backup skipped — database unchanged');
                return { path: destFile, skipped: true };
            }
        }
        fs.renameSync(tempFile, destFile);
        this.logger.log(`Backup complete: ${destFile}`);
        return { path: destFile, skipped: false };
    }
    fileHash(filePath) {
        const hash = crypto.createHash('sha256');
        const buf = fs.readFileSync(filePath);
        hash.update(buf);
        return hash.digest('hex');
    }
};
exports.BackupService = BackupService;
__decorate([
    (0, schedule_1.Cron)(BACKUP_CRON),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupService.prototype, "scheduledBackup", null);
exports.BackupService = BackupService = BackupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BackupService);
//# sourceMappingURL=backup.service.js.map