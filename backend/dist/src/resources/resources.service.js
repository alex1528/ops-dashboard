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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../crypto/crypto.service");
let ResourcesService = class ResourcesService {
    constructor(prisma, crypto) {
        this.prisma = prisma;
        this.crypto = crypto;
    }
    async findAll() {
        const resources = await this.prisma.resource.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
                credential: true,
                healthRecords: {
                    orderBy: { checkedAt: 'desc' },
                    take: 1,
                },
            },
        });
        return resources.map((r) => ({
            ...r,
            credential: r.credential
                ? {
                    id: r.credential.id,
                    username: '••••••',
                    hasPassword: !!r.credential.password,
                    hasExtra: !!r.credential.extra && r.credential.extra !== '',
                }
                : null,
            lastHealth: r.healthRecords[0] || null,
            healthRecords: undefined,
        }));
    }
    async findOne(id) {
        const r = await this.prisma.resource.findUnique({
            where: { id },
            include: {
                credential: true,
                healthRecords: { orderBy: { checkedAt: 'desc' }, take: 10 },
            },
        });
        if (!r)
            throw new common_1.NotFoundException();
        return {
            ...r,
            credential: r.credential
                ? {
                    id: r.credential.id,
                    username: '••••••',
                    hasPassword: !!r.credential.password,
                    hasExtra: !!r.credential.extra && r.credential.extra !== '',
                }
                : null,
        };
    }
    async getDecryptedCredential(resourceId) {
        const cred = await this.prisma.credential.findUnique({ where: { resourceId } });
        if (!cred)
            return { exists: false, username: '', password: '', extra: '' };
        try {
            return {
                exists: true,
                username: this.decryptStoredCredential(cred.username),
                password: this.decryptStoredCredential(cred.password),
                extra: cred.extra ? this.decryptStoredCredential(cred.extra) : '',
            };
        }
        catch (err) {
            throw new Error(`凭据解密失败: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    decryptStoredCredential(value) {
        if (!value)
            return '';
        if (!this.looksEncrypted(value))
            return value;
        return this.crypto.decrypt(value);
    }
    looksEncrypted(value) {
        const parts = value.split(':');
        return parts.length === 3
            && parts[0].length === 24
            && parts[1].length === 32
            && parts.every((part) => part.length > 0 && /^[0-9a-f]+$/i.test(part));
    }
    async create(dto) {
        const { credUsername, credPassword, credExtra, ...resourceData } = dto;
        const resource = await this.prisma.resource.create({ data: resourceData });
        if (credUsername || credPassword) {
            await this.prisma.credential.create({
                data: {
                    resourceId: resource.id,
                    username: this.crypto.encrypt(credUsername || ''),
                    password: this.crypto.encrypt(credPassword || ''),
                    extra: credExtra ? this.crypto.encrypt(credExtra) : '',
                },
            });
        }
        return this.findOne(resource.id);
    }
    async update(id, dto) {
        const existing = await this.prisma.resource.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        const { credUsername, credPassword, credExtra, ...resourceData } = dto;
        await this.prisma.resource.update({ where: { id }, data: resourceData });
        if (credUsername !== undefined || credPassword !== undefined) {
            const credData = {};
            if (credUsername !== undefined)
                credData.username = this.crypto.encrypt(credUsername);
            if (credPassword !== undefined)
                credData.password = this.crypto.encrypt(credPassword);
            if (credExtra !== undefined)
                credData.extra = this.crypto.encrypt(credExtra);
            const existingCred = await this.prisma.credential.findUnique({ where: { resourceId: id } });
            if (existingCred) {
                await this.prisma.credential.update({ where: { resourceId: id }, data: credData });
            }
            else if (credUsername || credPassword) {
                await this.prisma.credential.create({
                    data: {
                        resourceId: id,
                        username: credData.username ?? this.crypto.encrypt(''),
                        password: credData.password ?? this.crypto.encrypt(''),
                        extra: credData.extra ?? '',
                    },
                });
            }
        }
        return this.findOne(id);
    }
    async remove(id) {
        const existing = await this.prisma.resource.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        await this.prisma.resource.delete({ where: { id } });
        return { deleted: true };
    }
};
exports.ResourcesService = ResourcesService;
exports.ResourcesService = ResourcesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService])
], ResourcesService);
//# sourceMappingURL=resources.service.js.map