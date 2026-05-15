import { Injectable, Logger } from '@nestjs/common';
import { LoginAdapter, AuthResult } from './login-adapter.interface';

/**
 * PocketBase adapter — used by Beszel.
 *
 * Auth flow:
 *   POST /api/collections/_superusers/auth-with-password  {identity, password}
 *   → { token: "jwt...", record: {...} }
 *
 * The token is injected into the proxied HTML via a <script> that sets
 * localStorage['pocketbase_auth'], which the PocketBase SPA reads on load.
 */
@Injectable()
export class PocketBaseAdapter implements LoginAdapter {
  readonly type = 'pocketbase';
  private readonly logger = new Logger(PocketBaseAdapter.name);

  async authenticate(
    targetUrl: string,
    username: string,
    password: string,
  ): Promise<AuthResult | null> {
    const base = targetUrl.replace(/\/+$/, '');

    // Try _superusers first, then users collection
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
            // PocketBase tokens are typically valid for a long time; refresh when needed
            expiresAt: Date.now() + 3600_000,
          };
        }
      } catch (err: any) {
        this.logger.warn(`PocketBase auth attempt ${collection} failed: ${err.message}`);
      }
    }
    return null;
  }

  injectAuth(headers: Record<string, string | string[]>, auth: AuthResult): void {
    headers['Authorization'] = auth.data.token;
  }

  rewriteHtml(html: string, auth: AuthResult, targetUrl: string): string | null {
    // Inject a script that sets PocketBase's localStorage auth store
    // so the SPA recognizes the user as logged in on first load.
    const storeValue = JSON.stringify({
      token: auth.data.token,
      record: auth.data.record,
    });
    const script = `<script>
try {
  localStorage.setItem('pocketbase_auth', ${JSON.stringify(storeValue)});
} catch(e) {}
</script>`;
    // Insert right after <head> or at the start of <body>
    if (html.includes('<head>')) {
      return html.replace('<head>', '<head>' + script);
    }
    if (html.includes('<body>')) {
      return html.replace('<body>', '<body>' + script);
    }
    return script + html;
  }
}
