"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GenericFormAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericFormAdapter = void 0;
const common_1 = require("@nestjs/common");
let GenericFormAdapter = GenericFormAdapter_1 = class GenericFormAdapter {
    constructor() {
        this.type = 'generic-form';
        this.logger = new common_1.Logger(GenericFormAdapter_1.name);
    }
    async authenticate(targetUrl, username, password, extra) {
        const base = targetUrl.replace(/\/+$/, '');
        let config = {};
        try {
            if (extra)
                config = JSON.parse(extra);
        }
        catch { }
        const loginPath = config.loginPath || '/api/login';
        const usernameField = config.usernameField || 'username';
        const passwordField = config.passwordField || 'password';
        const method = config.method || 'POST';
        const contentType = config.contentType || 'application/json';
        const endpoints = config.loginPath ? [loginPath] : [
            '/api/login',
            '/api/auth/login',
            '/login',
            '/api/user/login',
            '/api/system/login',
        ];
        for (const endpoint of endpoints) {
            try {
                let body;
                let headers = {};
                if (contentType === 'application/x-www-form-urlencoded') {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    body = `${encodeURIComponent(usernameField)}=${encodeURIComponent(username)}&${encodeURIComponent(passwordField)}=${encodeURIComponent(password)}`;
                }
                else {
                    headers['Content-Type'] = 'application/json';
                    body = JSON.stringify({ [usernameField]: username, [passwordField]: password });
                }
                const res = await fetch(`${base}${endpoint}`, {
                    method,
                    headers,
                    body,
                    redirect: 'manual',
                });
                if (res.status !== 200 && res.status !== 302)
                    continue;
                const cookies = res.headers.getSetCookie?.() || [];
                let token = null;
                if (res.status === 200) {
                    try {
                        const json = await res.json();
                        token = json?.token || json?.data?.token || json?.access_token || json?.data?.access_token || null;
                    }
                    catch {
                    }
                }
                if (cookies.length > 0 || token) {
                    this.logger.log(`Generic form auth success via ${endpoint} for ${base}`);
                    return {
                        data: { token, cookies, endpoint },
                        expiresAt: Date.now() + 3600_000,
                    };
                }
            }
            catch (err) {
                this.logger.warn(`Generic form auth attempt ${endpoint} failed: ${err.message}`);
            }
        }
        return null;
    }
    injectAuth(headers, auth) {
        if (auth.data.token) {
            headers['Authorization'] = `Bearer ${auth.data.token}`;
        }
        if (auth.data.cookies?.length) {
            const existing = headers['cookie'] || '';
            const loginCookies = auth.data.cookies
                .map((c) => c.split(';')[0])
                .join('; ');
            headers['cookie'] = existing ? `${existing}; ${loginCookies}` : loginCookies;
        }
    }
    rewriteHtml(html, auth) {
        if (!auth.data.token)
            return null;
        const script = `<script>
try {
  localStorage.setItem('token', ${JSON.stringify(auth.data.token)});
} catch(e) {}
</script>`;
        if (html.includes('<head>')) {
            return html.replace('<head>', '<head>' + script);
        }
        return null;
    }
};
exports.GenericFormAdapter = GenericFormAdapter;
exports.GenericFormAdapter = GenericFormAdapter = GenericFormAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], GenericFormAdapter);
//# sourceMappingURL=generic-form.adapter.js.map