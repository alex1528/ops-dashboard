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
var ProxyController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const proxy_auth_guard_1 = require("./proxy-auth.guard");
const proxy_service_1 = require("./proxy.service");
const proxy_session_store_1 = require("./proxy-session.store");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
let ProxyController = ProxyController_1 = class ProxyController {
    constructor(proxyService, sessionStore, audit, prisma) {
        this.proxyService = proxyService;
        this.sessionStore = sessionStore;
        this.audit = audit;
        this.prisma = prisma;
        this.logger = new common_1.Logger(ProxyController_1.name);
    }
    async launch(id, req, res) {
        const resource = await this.prisma.resource.findUnique({ where: { id } });
        if (!resource) {
            res.status(404).json({ error: 'Resource not found' });
            return;
        }
        await this.audit.log(req.user?.id, 'proxy.launch', id, resource.name, req.ip);
        if (resource.loginMode === 'link') {
            res.redirect(resource.url);
            return;
        }
        if (resource.loginMode === 'semi-auto') {
            const prefill = await this.proxyService.getPreFillData(id);
            res.json({
                mode: 'semi-auto',
                targetUrl: resource.url,
                prefill: prefill ? { username: prefill.username, password: prefill.password } : null,
            });
            return;
        }
        const session = await this.proxyService.getSession(id);
        if (!session) {
            this.logger.warn(`Auto-login failed for ${resource.name}, falling back to direct link`);
            res.json({
                mode: 'fallback',
                targetUrl: resource.url,
                error: 'Auto-login failed, opening direct link',
            });
            return;
        }
        const userId = req.user?.id || 'unknown';
        const proxyToken = this.sessionStore.create(userId, id);
        res.cookie('ops_proxy_session', proxyToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: `/api/proxy/${id}`,
            maxAge: 30 * 60 * 1000,
        });
        res.json({
            mode: 'auto',
            proxyUrl: `/api/proxy/${id}/`,
            targetUrl: resource.url,
        });
    }
    async prefill(id, req, res) {
        await this.audit.log(req.user?.id, 'proxy.prefill', id, '', req.ip);
        const data = await this.proxyService.getPreFillData(id);
        if (!data) {
            res.status(404).json({ error: 'No credentials found' });
            return;
        }
        res.json(data);
    }
    async proxyRoot(id, req, res) {
        return this.proxyRequest(id, '', req, res);
    }
    async proxyRequest(id, path, req, res) {
        const session = await this.proxyService.getSession(id);
        if (!session) {
            res.status(502).json({ error: 'Unable to establish authenticated session with target' });
            return;
        }
        const { authResult, adapter, targetUrl } = session;
        const base = targetUrl.replace(/\/+$/, '');
        const targetPath = '/' + (path || '');
        const targetFullUrl = `${base}${targetPath}`;
        try {
            const proxyHeaders = {};
            for (const key of ['accept', 'accept-language', 'content-type', 'content-length']) {
                if (req.headers[key]) {
                    proxyHeaders[key] = req.headers[key];
                }
            }
            adapter.injectAuth(proxyHeaders, authResult);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            const fetchOptions = {
                method: req.method,
                headers: proxyHeaders,
                signal: controller.signal,
                redirect: 'manual',
            };
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                if (chunks.length > 0) {
                    fetchOptions.body = Buffer.concat(chunks);
                }
            }
            const targetRes = await fetch(targetFullUrl, fetchOptions);
            clearTimeout(timer);
            if (targetRes.status >= 300 && targetRes.status < 400) {
                const location = targetRes.headers.get('location');
                if (location) {
                    let rewritten = location;
                    if (location.startsWith(base)) {
                        rewritten = `/api/proxy/${id}${location.slice(base.length)}`;
                    }
                    else if (location.startsWith('/')) {
                        rewritten = `/api/proxy/${id}${location}`;
                    }
                    res.redirect(targetRes.status, rewritten);
                    return;
                }
            }
            const skipHeaders = new Set(['transfer-encoding', 'content-encoding', 'content-security-policy']);
            targetRes.headers.forEach((value, key) => {
                if (!skipHeaders.has(key.toLowerCase())) {
                    res.setHeader(key, value);
                }
            });
            const contentType = targetRes.headers.get('content-type') || '';
            if (contentType.includes('text/html') && adapter.rewriteHtml) {
                const html = await targetRes.text();
                const rewritten = adapter.rewriteHtml(html, authResult, targetUrl);
                const finalHtml = rewritten || html;
                const rewrittenHtml = this.rewriteUrls(finalHtml, base, id);
                res.setHeader('content-type', contentType);
                res.status(targetRes.status).send(rewrittenHtml);
                return;
            }
            res.status(targetRes.status);
            if (targetRes.body) {
                const reader = targetRes.body.getReader();
                const pump = async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        res.write(value);
                    }
                    res.end();
                };
                await pump();
            }
            else {
                res.end();
            }
        }
        catch (err) {
            this.logger.error(`Proxy error for ${id}: ${err.message}`);
            if (!res.headersSent) {
                res.status(502).json({ error: 'Proxy error', detail: err.message });
            }
        }
    }
    rewriteUrls(html, targetBase, resourceId) {
        const escaped = targetBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        let rewritten = html.replace(regex, `/api/proxy/${resourceId}`);
        rewritten = rewritten.replace(/(href|src)=(["'])\/(?!\/|api\/proxy\/)/g, `$1=$2/api/proxy/${resourceId}/`);
        return rewritten;
    }
};
exports.ProxyController = ProxyController;
__decorate([
    (0, common_1.Get)(':id/launch'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "launch", null);
__decorate([
    (0, common_1.Get)(':id/prefill'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "prefill", null);
__decorate([
    (0, common_1.All)(':id'),
    (0, common_1.UseGuards)(proxy_auth_guard_1.ProxyAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "proxyRoot", null);
__decorate([
    (0, common_1.All)(':id/*path'),
    (0, common_1.UseGuards)(proxy_auth_guard_1.ProxyAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('path')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "proxyRequest", null);
exports.ProxyController = ProxyController = ProxyController_1 = __decorate([
    (0, common_1.Controller)('proxy'),
    __metadata("design:paramtypes", [proxy_service_1.ProxyService,
        proxy_session_store_1.ProxySessionStore,
        audit_service_1.AuditService,
        prisma_service_1.PrismaService])
], ProxyController);
//# sourceMappingURL=proxy.controller.js.map