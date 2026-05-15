import { Injectable, Logger } from '@nestjs/common';
import { LoginAdapter, AuthResult } from './login-adapter.interface';

/**
 * Certd adapter — Midway.js-based certificate management system.
 *
 * Auth flow (observed from browser DevTools):
 *   POST /api/sys/authority/login  { username, password }
 *   → { code: 0, data: { token: "...", ... } }
 *
 * Token is passed via Authorization header on subsequent requests.
 * Also injects the token into HTML via script for the Vue SPA.
 */
@Injectable()
export class CertdAdapter implements LoginAdapter {
  readonly type = 'certd';
  private readonly logger = new Logger(CertdAdapter.name);

  async authenticate(
    targetUrl: string,
    username: string,
    password: string,
  ): Promise<AuthResult | null> {
    const base = targetUrl.replace(/\/+$/, '');

    // Try common Certd login endpoints
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

        if (!res.ok) continue;

        const body = await res.json();
        // Certd typically returns { code: 0, data: { token, ... } }
        const token = body?.data?.token || body?.token || body?.data?.access_token;
        if (!token) continue;

        this.logger.log(`Certd auth success via ${endpoint} for ${base}`);

        // Collect any Set-Cookie headers
        const cookies = res.headers.getSetCookie?.() || [];

        return {
          data: { token, cookies, endpoint },
          expiresAt: Date.now() + 7200_000, // 2h default
        };
      } catch (err: any) {
        this.logger.warn(`Certd auth attempt ${endpoint} failed: ${err.message}`);
      }
    }
    return null;
  }

  injectAuth(headers: Record<string, string | string[]>, auth: AuthResult): void {
    headers['Authorization'] = `Bearer ${auth.data.token}`;
    // Forward cookies if any were set during login
    if (auth.data.cookies?.length) {
      const existing = (headers['cookie'] as string) || '';
      const loginCookies = auth.data.cookies
        .map((c: string) => c.split(';')[0])
        .join('; ');
      headers['cookie'] = existing ? `${existing}; ${loginCookies}` : loginCookies;
    }
  }

  rewriteHtml(html: string, auth: AuthResult): string | null {
    // Inject token into localStorage for Certd's Vue SPA
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
}
