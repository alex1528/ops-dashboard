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
var ProxyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../crypto/crypto.service");
const pocketbase_adapter_1 = require("./adapters/pocketbase.adapter");
const certd_adapter_1 = require("./adapters/certd.adapter");
const generic_form_adapter_1 = require("./adapters/generic-form.adapter");
let ProxyService = ProxyService_1 = class ProxyService {
    constructor(prisma, crypto, pocketbase, certd, genericForm) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.logger = new common_1.Logger(ProxyService_1.name);
        this.adapters = new Map();
        this.sessionCache = new Map();
        this.modeToAdapter = {
            'auto': 'auto-detect',
            'semi-auto': 'semi-auto',
            'link': 'none',
        };
        this.adapters.set('pocketbase', pocketbase);
        this.adapters.set('certd', certd);
        this.adapters.set('generic-form', genericForm);
        this.cacheCleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [key, session] of this.sessionCache) {
                if (session.authResult.expiresAt <= now) {
                    this.sessionCache.delete(key);
                }
            }
        }, 10 * 60 * 1000);
    }
    onModuleDestroy() {
        clearInterval(this.cacheCleanupTimer);
    }
    async getSession(resourceId) {
        const cached = this.sessionCache.get(resourceId);
        if (cached && cached.authResult.expiresAt > Date.now()) {
            const adapter = this.adapters.get(cached.adapterType);
            if (adapter) {
                const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
                if (resource) {
                    return { authResult: cached.authResult, adapter, targetUrl: resource.url };
                }
            }
        }
        const resource = await this.prisma.resource.findUnique({
            where: { id: resourceId },
            include: { credential: true },
        });
        if (!resource)
            return null;
        if (resource.loginMode === 'link')
            return null;
        if (!resource.credential) {
            this.logger.warn(`No credential configured for resource ${resource.name}`);
            return null;
        }
        let username, password, extra;
        try {
            username = this.crypto.decrypt(resource.credential.username);
            password = this.crypto.decrypt(resource.credential.password);
            extra = resource.credential.extra ? this.crypto.decrypt(resource.credential.extra) : '';
        }
        catch (err) {
            this.logger.error(`Failed to decrypt credential for ${resource.name}: ${err.message}`);
            return null;
        }
        const adapter = await this.detectAdapter(resource.url, resource.loginMode, extra);
        if (!adapter) {
            this.logger.warn(`No suitable adapter found for ${resource.name}`);
            return null;
        }
        const authResult = await adapter.authenticate(resource.url, username, password, extra);
        if (!authResult) {
            this.logger.warn(`Authentication failed for ${resource.name} using ${adapter.type}`);
            return null;
        }
        this.sessionCache.set(resourceId, {
            resourceId,
            authResult,
            adapterType: adapter.type,
        });
        return { authResult, adapter, targetUrl: resource.url };
    }
    clearSession(resourceId) {
        this.sessionCache.delete(resourceId);
    }
    async getPreFillData(resourceId) {
        const resource = await this.prisma.resource.findUnique({
            where: { id: resourceId },
            include: { credential: true },
        });
        if (!resource || !resource.credential)
            return null;
        try {
            return {
                targetUrl: resource.url,
                username: this.crypto.decrypt(resource.credential.username),
                password: this.crypto.decrypt(resource.credential.password),
            };
        }
        catch {
            return null;
        }
    }
    async detectAdapter(targetUrl, loginMode, extra) {
        try {
            const config = extra ? JSON.parse(extra) : {};
            if (config.adapterType && this.adapters.has(config.adapterType)) {
                return this.adapters.get(config.adapterType);
            }
        }
        catch { }
        if (loginMode === 'semi-auto') {
            return this.adapters.get('generic-form');
        }
        const base = targetUrl.replace(/\/+$/, '');
        try {
            const res = await fetch(`${base}/api/health`, { method: 'GET' });
            if (res.ok) {
                const body = await res.json();
                if (body.code === 200 || body.message === 'API is healthy.') {
                    this.logger.log(`Detected PocketBase at ${base}`);
                    return this.adapters.get('pocketbase');
                }
            }
        }
        catch { }
        try {
            const res = await fetch(`${base}/api/sys/authority/login`, {
                method: 'OPTIONS',
            });
            if (res.status !== 404) {
                this.logger.log(`Detected Certd-like system at ${base}`);
                return this.adapters.get('certd');
            }
        }
        catch { }
        this.logger.log(`Using generic-form adapter for ${base}`);
        return this.adapters.get('generic-form');
    }
};
exports.ProxyService = ProxyService;
exports.ProxyService = ProxyService = ProxyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService,
        pocketbase_adapter_1.PocketBaseAdapter,
        certd_adapter_1.CertdAdapter,
        generic_form_adapter_1.GenericFormAdapter])
], ProxyService);
//# sourceMappingURL=proxy.service.js.map