import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ProxySessionStore } from './proxy-session.store';
export declare class ProxyAuthGuard implements CanActivate {
    private sessionStore;
    private jwtGuard;
    constructor(sessionStore: ProxySessionStore);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
