"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CertdAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertdAdapter = void 0;
const common_1 = require("@nestjs/common");
let CertdAdapter = CertdAdapter_1 = class CertdAdapter {
    constructor() {
        this.type = 'certd';
        this.logger = new common_1.Logger(CertdAdapter_1.name);
    }
    async authenticate(targetUrl, username, password) {
        const base = targetUrl.replace(/\/+$/, '');
        const endpoints = [
            '/api/sys/authority/login',
            '/api/login',
        ];
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${base}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                    redirect: 'manual',
                });
                if (!res.ok)
                    continue;
                const body = await res.json();
                const token = body?.data?.token || body?.token || body?.data?.access_token;
                if (!token)
                    continue;
                this.logger.log(`Certd auth success via ${endpoint} for ${base}`);
                const cookies = res.headers.getSetCookie?.() || [];
                return {
                    data: { token, cookies, endpoint },
                    expiresAt: Date.now() + 7200_000,
                };
            }
            catch (err) {
                this.logger.warn(`Certd auth attempt ${endpoint} failed: ${err.message}`);
            }
        }
        return null;
    }
    injectAuth(headers, auth) {
        headers['Authorization'] = `Bearer ${auth.data.token}`;
        if (auth.data.cookies?.length) {
            const existing = headers['cookie'] || '';
            const loginCookies = auth.data.cookies
                .map((c) => c.split(';')[0])
                .join('; ');
            headers['cookie'] = existing ? `${existing}; ${loginCookies}` : loginCookies;
        }
    }
    rewriteHtml(html, auth) {
        const script = `<script>
try {
  localStorage.setItem('token', ${JSON.stringify(auth.data.token)});
  localStorage.setItem('access_token', ${JSON.stringify(auth.data.token)});
} catch(e) {}
</script>`;
        if (html.includes('<head>')) {
            return html.replace('<head>', '<head>' + script);
        }
        return null;
    }
};
exports.CertdAdapter = CertdAdapter;
exports.CertdAdapter = CertdAdapter = CertdAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], CertdAdapter);
//# sourceMappingURL=certd.adapter.js.map