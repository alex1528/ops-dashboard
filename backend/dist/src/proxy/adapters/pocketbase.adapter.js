"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PocketBaseAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PocketBaseAdapter = void 0;
const common_1 = require("@nestjs/common");
let PocketBaseAdapter = PocketBaseAdapter_1 = class PocketBaseAdapter {
    constructor() {
        this.type = 'pocketbase';
        this.logger = new common_1.Logger(PocketBaseAdapter_1.name);
    }
    async authenticate(targetUrl, username, password) {
        const base = targetUrl.replace(/\/+$/, '');
        for (const collection of ['_superusers', 'users']) {
            try {
                const res = await fetch(`${base}/api/collections/${collection}/auth-with-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identity: username, password }),
                });
                if (res.ok) {
                    const body = await res.json();
                    this.logger.log(`PocketBase auth success via ${collection} for ${base}`);
                    return {
                        data: {
                            token: body.token,
                            record: body.record,
                            collection,
                        },
                        expiresAt: Date.now() + 3600_000,
                    };
                }
            }
            catch (err) {
                this.logger.warn(`PocketBase auth attempt ${collection} failed: ${err.message}`);
            }
        }
        return null;
    }
    injectAuth(headers, auth) {
        headers['Authorization'] = auth.data.token;
    }
    rewriteHtml(html, auth, targetUrl) {
        const storeValue = JSON.stringify({
            token: auth.data.token,
            record: auth.data.record,
        });
        const script = `<script>
try {
  localStorage.setItem('pocketbase_auth', ${JSON.stringify(storeValue)});
} catch(e) {}
</script>`;
        if (html.includes('<head>')) {
            return html.replace('<head>', '<head>' + script);
        }
        if (html.includes('<body>')) {
            return html.replace('<body>', '<body>' + script);
        }
        return script + html;
    }
};
exports.PocketBaseAdapter = PocketBaseAdapter;
exports.PocketBaseAdapter = PocketBaseAdapter = PocketBaseAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], PocketBaseAdapter);
//# sourceMappingURL=pocketbase.adapter.js.map