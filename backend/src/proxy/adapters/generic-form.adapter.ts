import { Injectable, Logger } from '@nestjs/common';
import { LoginAdapter, AuthResult } from './login-adapter.interface';

/**
 * Generic form-login adapter — works for systems that use standard
 * HTML form POST or JSON API login with cookie-based sessions.
 *
 * This adapter tries multiple common login endpoint patterns and
 * captures Set-Cookie headers from the response.
 *
 * Used as fallback for TERMIXE and other unknown systems.
 * Also used for semi-auto mode (captcha systems) — in that case
 * authenticate() returns null and the frontend handles pre-fill.
 */
@Injectable()
export class GenericFormAdapter implements LoginAdapter {
  readonly type = 'generic-form';
  private readonly logger = new Logger(GenericFormAdapter.name);

  async authenticate(
    targetUrl: string,
    username: string,
    password: string,
    extra: string,
  ): Promise<AuthResult | null> {
    const base = targetUrl.replace(/\/+$/, '');

    // Parse extra field for custom config
    let config: any = {};
    try {
      if (extra) config = JSON.parse(extra);
    } catch {}

    // Allow custom login endpoint and field names via extra
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
        let body: string;
        let headers: Record<string, string> = {};

        if (contentType === 'application/x-www-form-urlencoded') {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body = `${encodeURIComponent(usernameField)}=${encodeURIComponent(username)}&${encodeURIComponent(passwordField)}=${encodeURIComponent(password)}`;
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ [usernameField]: username, [passwordField]: password });
        }

        const res = await fetch(`${base}${endpoint}`, {
          method,
          headers,
          body,
          redirect: 'manual',
        });

        // Accept 200, 302 (redirect after login) as success
        if (res.status !== 200 && res.status !== 302) continue;

        const cookies = res.headers.getSetCookie?.() || [];
        let token: string | null = null;

        // Try to extract token from JSON response
        if (res.status === 200) {
          try {
            const json = await res.json();
            token = json?.token || json?.data?.token || json?.access_token || json?.data?.access_token || null;
          } catch {
            // Not JSON — might be a redirect-based login
          }
        }

        if (cookies.length > 0 || token) {
          this.logger.log(`Generic form auth success via ${endpoint} for ${base}`);
          return {
            data: { token, cookies, endpoint },
            expiresAt: Date.now() + 3600_000,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Generic form auth attempt ${endpoint} failed: ${err.message}`);
      }
    }
    return null;
  }

  injectAuth(headers: Record<string, string | string[]>, auth: AuthResult): void {
    if (auth.data.token) {
      headers['Authorization'] = `Bearer ${auth.data.token}`;
    }
    if (auth.data.cookies?.length) {
      const existing = (headers['cookie'] as string) || '';
      const loginCookies = auth.data.cookies
        .map((c: string) => c.split(';')[0])
        .join('; ');
      headers['cookie'] = existing ? `${existing}; ${loginCookies}` : loginCookies;
    }
  }

  rewriteHtml(html: string, auth: AuthResult): string | null {
    if (!auth.data.token) return null;
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
}
