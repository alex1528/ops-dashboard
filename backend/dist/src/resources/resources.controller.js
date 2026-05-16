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
var ResourcesController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const resources_service_1 = require("./resources.service");
const resources_dto_1 = require("./resources.dto");
const audit_service_1 = require("../audit/audit.service");
let ResourcesController = ResourcesController_1 = class ResourcesController {
    constructor(resources, audit) {
        this.resources = resources;
        this.audit = audit;
        this.logger = new common_1.Logger(ResourcesController_1.name);
    }
    findAll() {
        return this.resources.findAll();
    }
    findOne(id) {
        return this.resources.findOne(id);
    }
    async getCredential(id, req) {
        try {
            await this.audit.log(req.user?.id, 'credential.view', id, '', req.ip);
            const result = await this.resources.getDecryptedCredential(id);
            return result;
        }
        catch (err) {
            this.logger.error(`Failed to read credential for resource ${id}`, err instanceof Error ? err.stack : String(err));
            throw new common_1.HttpException({ message: '凭据获取失败，请联系管理员' }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async create(dto, req) {
        const result = await this.resources.create(dto);
        await this.audit.log(req.user?.id, 'resource.create', result.id, dto.name, req.ip);
        return result;
    }
    async update(id, dto, req) {
        const result = await this.resources.update(id, dto);
        await this.audit.log(req.user?.id, 'resource.update', id, '', req.ip);
        return result;
    }
    async remove(id, req) {
        await this.audit.log(req.user?.id, 'resource.delete', id, '', req.ip);
        return this.resources.remove(id);
    }
};
exports.ResourcesController = ResourcesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/credential'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getCredential", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resources_dto_1.CreateResourceDto, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, resources_dto_1.UpdateResourceDto, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "remove", null);
exports.ResourcesController = ResourcesController = ResourcesController_1 = __decorate([
    (0, common_1.Controller)('resources'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [resources_service_1.ResourcesService,
        audit_service_1.AuditService])
], ResourcesController);
//# sourceMappingURL=resources.controller.js.map