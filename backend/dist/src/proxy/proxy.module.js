"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyModule = void 0;
const common_1 = require("@nestjs/common");
const proxy_controller_1 = require("./proxy.controller");
const proxy_service_1 = require("./proxy.service");
const proxy_session_store_1 = require("./proxy-session.store");
const proxy_auth_guard_1 = require("./proxy-auth.guard");
const pocketbase_adapter_1 = require("./adapters/pocketbase.adapter");
const certd_adapter_1 = require("./adapters/certd.adapter");
const generic_form_adapter_1 = require("./adapters/generic-form.adapter");
let ProxyModule = class ProxyModule {
};
exports.ProxyModule = ProxyModule;
exports.ProxyModule = ProxyModule = __decorate([
    (0, common_1.Module)({
        controllers: [proxy_controller_1.ProxyController],
        providers: [
            proxy_service_1.ProxyService,
            proxy_session_store_1.ProxySessionStore,
            proxy_auth_guard_1.ProxyAuthGuard,
            pocketbase_adapter_1.PocketBaseAdapter,
            certd_adapter_1.CertdAdapter,
            generic_form_adapter_1.GenericFormAdapter,
        ],
        exports: [proxy_service_1.ProxyService, proxy_session_store_1.ProxySessionStore],
    })
], ProxyModule);
//# sourceMappingURL=proxy.module.js.map