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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const health_check_service_1 = require("./health-check.service");
const prisma_service_1 = require("../prisma/prisma.service");
let HealthCheckController = class HealthCheckController {
    constructor(healthCheck, prisma) {
        this.healthCheck = healthCheck;
        this.prisma = prisma;
    }
    ping() {
        return { ok: true };
    }
    async getStatus() {
        const resources = await this.prisma.resource.findMany({
            where: { enabled: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
                healthRecords: { orderBy: { checkedAt: 'desc' }, take: 1 },
            },
        });
        return resources.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url,
            group: r.group,
            loginMode: r.loginMode,
            description: r.description,
            healthCheckEnabled: r.healthCheckEnabled,
            lastHealth: r.healthCheckEnabled
                ? (r.healthRecords[0] || null)
                : { status: 'up', statusCode: null, responseMs: null, checkedAt: new Date().toISOString(), skipped: true },
        }));
    }
    async triggerCheck(id) {
        const resource = await this.prisma.resource.findUnique({ where: { id } });
        if (!resource)
            return { error: 'Not found' };
        if (!resource.healthCheckEnabled)
            return { resourceId: id, status: 'up', skipped: true };
        return this.healthCheck.checkOne(resource.id, resource.url);
    }
    async getHistory(id) {
        return this.healthCheck.getHistory(id);
    }
};
exports.HealthCheckController = HealthCheckController;
__decorate([
    (0, common_1.Get)('ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthCheckController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthCheckController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)(':id/check'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HealthCheckController.prototype, "triggerCheck", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HealthCheckController.prototype, "getHistory", null);
exports.HealthCheckController = HealthCheckController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [health_check_service_1.HealthCheckService,
        prisma_service_1.PrismaService])
], HealthCheckController);
//# sourceMappingURL=health-check.controller.js.map