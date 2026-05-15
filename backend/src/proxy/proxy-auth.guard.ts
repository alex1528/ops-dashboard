import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProxySessionStore } from './proxy-session.store';

/**
 * Guard for proxy routes: accepts either a JWT Bearer token or
 * an `ops_proxy_session` httpOnly cookie set by the /launch endpoint.
 * This allows new-tab navigation to work without explicit JWT headers.
 */
@Injectable()
export class ProxyAuthGuard implements CanActivate {
  private jwtGuard: CanActivate;

  constructor(private sessionStore: ProxySessionStore) {
    // Reuse the passport JWT strategy guard
    this.jwtGuard = new (AuthGuard('jwt'))();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Try JWT first (for XHR calls from the main SPA)
    try {
      const jwtResult = await (this.jwtGuard as any).canActivate(context);
      if (jwtResult) return true;
    } catch {
      // JWT auth failed, try cookie
    }

    // Try proxy session cookie
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.ops_proxy_session;
    if (!token) return false;

    const session = this.sessionStore.validate(token);
    if (!session) return false;

    // Attach minimal user info to request (similar to what JWT strategy does)
    req.user = { id: session.userId, proxyResourceId: session.resourceId };
    return true;
  }
}
