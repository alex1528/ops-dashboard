"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var HealthCheckService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
let HealthCheckService = HealthCheckService_1 = class HealthCheckService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(HealthCheckService_1.name);
    }
    async checkAll() {
        const resources = await this.prisma.resource.findMany({ where: { enabled: true } });
        const timeoutMs = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '10000', 10);
        for (const resource of resources) {
            if (!resource.healthCheckEnabled)
                continue;
            await this.checkOne(resource.id, resource.url, timeoutMs);
        }
    }
    async checkOne(resourceId, url, timeoutMs = 10000) {
        const start = Date.now();
        let status = 'unknown';
        let statusCode = null;
        let error = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                const res = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal,
                    redirect: 'follow',
                });
                clearTimeout(timer);
                statusCode = res.status;
                status = res.ok ? 'up' : 'down';
                error = null;
                break;
            }
            catch (err) {
                status = 'down';
                error = err.message?.substring(0, 500) || 'Unknown error';
                if (attempt === 0) {
                    await new Promise((r) => setTimeout(r, 2000));
                }
            }
        }
        const responseMs = Date.now() - start;
        await this.prisma.healthRecord.create({
            data: { resourceId, status, statusCode, responseMs, error },
        });
        const records = await this.prisma.healthRecord.findMany({
            where: { resourceId },
            orderBy: { checkedAt: 'desc' },
            skip: 100,
            select: { id: true },
        });
        if (records.length > 0) {
            await this.prisma.healthRecord.deleteMany({
                where: { id: { in: records.map((r) => r.id) } },
            });
        }
        return { resourceId, status, statusCode, responseMs, error };
    }
    async getHistory(resourceId, limit = 20) {
        return this.prisma.healthRecord.findMany({
            where: { resourceId },
            orderBy: { checkedAt: 'desc' },
            take: limit,
        });
    }
};
exports.HealthCheckService = HealthCheckService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthCheckService.prototype, "checkAll", null);
exports.HealthCheckService = HealthCheckService = HealthCheckService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HealthCheckService);
//# sourceMappingURL=health-check.service.js.map