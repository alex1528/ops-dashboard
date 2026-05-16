import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { LoginAdapter, AuthResult } from './adapters/login-adapter.interface';
import { PocketBaseAdapter } from './adapters/pocketbase.adapter';
import { CertdAdapter } from './adapters/certd.adapter';
import { GenericFormAdapter } from './adapters/generic-form.adapter';

interface CachedSession {
  resourceId: string;
  authResult: AuthResult;
  adapterType: string;
}

@Injectable()
export class ProxyService implements OnModuleDestroy {
  private readonly logger = new Logger(ProxyService.name);
  private readonly adapters: Map<string, LoginAdapter> = new Map();
  private readonly sessionCache: Map<string, CachedSession> = new Map();
  private readonly cacheCleanupTimer: NodeJS.Timeout;

  /** Maps loginMode values to adapter types */
  private readonly modeToAdapter: Record<string, string> = {
    'auto': 'auto-detect',    // will try to detect
    'semi-auto': 'semi-auto', // pre-fill only, no full auto
    'link': 'none',           // external link, no proxy
  };

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    pocketbase: PocketBaseAdapter,
    certd: CertdAdapter,
    genericForm: GenericFormAdapter,
  ) {
    this.adapters.set('pocketbase', pocketbase);
    this.adapters.set('certd', certd);
    this.adapters.set('generic-form', genericForm);

    // Periodically evict expired sessions from cache
    this.cacheCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, session] of this.sessionCache) {
        if (session.authResult.expiresAt <= now) {
          this.sessionCache.delete(key);
        }
      }
    }, 10 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cacheCleanupTimer);
  }

  /**
   * Get or create an authenticated session for a resource.
   * Returns the AuthResult + adapter, or null if auth failed / not applicable.
   */
  async getSession(resourceId: string): Promise<{
    authResult: AuthResult;
    adapter: LoginAdapter;
    targetUrl: string;
  } | null> {
    // Check cache
    const cached = this.sessionCache.get(resourceId);
    if (cached && cached.authResult.expiresAt > Date.now()) {
      const adapter = this.adapters.get(cached.adapterType);
      if (adapter) {
        const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
        if (resource) {
          return { authResult: cached.authResult, adapter, targetUrl: resource.url };
        }
      }
    }

    // Load resource + credential
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: { credential: true },
    });
    if (!resource) return null;
    if (resource.loginMode === 'link') return null;

    if (!resource.credential) {
      this.logger.warn(`No credential configured for resource ${resource.name}`);
      return null;
    }

    // Decrypt credential
    let username: string, password: string, extra: string;
    try {
      username = this.decryptCred(resource.credential.username);
      password = this.decryptCred(resource.credential.password);
      extra = resource.credential.extra ? this.decryptCred(resource.credential.extra) : '';
    } catch (err: any) {
      this.logger.error(`Failed to decrypt credential for ${resource.name}: ${err.message}`);
      return null;
    }

    // Determine adapter
    const adapter = await this.detectAdapter(resource.url, resource.loginMode, extra);
    if (!adapter) {
      this.logger.warn(`No suitable adapter found for ${resource.name}`);
      return null;
    }

    // Authenticate
    const authResult = await adapter.authenticate(resource.url, username, password, extra);
    if (!authResult) {
      this.logger.warn(`Authentication failed for ${resource.name} using ${adapter.type}`);
      return null;
    }

    // Cache
    this.sessionCache.set(resourceId, {
      resourceId,
      authResult,
      adapterType: adapter.type,
    });

    return { authResult, adapter, targetUrl: resource.url };
  }

  /**
   * Clear cached session for a resource (e.g., after credential update).
   */
  clearSession(resourceId: string) {
    this.sessionCache.delete(resourceId);
  }

  /**
   * Get pre-fill info for semi-auto mode (captcha systems).
   * Returns decrypted username/password for the frontend to inject.
   */
  async getPreFillData(resourceId: string): Promise<{
    targetUrl: string;
    username: string;
    password: string;
  } | null> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: { credential: true },
    });
    if (!resource || !resource.credential) return null;

    try {
      return {
        targetUrl: resource.url,
        username: this.decryptCred(resource.credential.username),
        password: this.decryptCred(resource.credential.password),
      };
    } catch {
      return null;
    }
  }

  /**
   * Decrypt a stored credential value, with backward-compat for legacy plaintext.
   * Mirrors the same logic in ResourcesService to keep the two services consistent.
   */
  private decryptCred(value: string): string {
    if (!value) return '';
    const parts = value.split(':');
    const isEncrypted =
      parts.length === 3 &&
      parts[0].length === 24 &&
      parts[1].length === 32 &&
      parts.every((p) => p.length > 0 && /^[0-9a-f]+$/i.test(p));
    return isEncrypted ? this.crypto.decrypt(value) : value;
  }

  /**
   * Detect which adapter to use based on the target URL's response.
   */
  private async detectAdapter(
    targetUrl: string,
    loginMode: string,
    extra: string,
  ): Promise<LoginAdapter | null> {
    // Parse extra for explicit adapter type
    try {
      const config = extra ? JSON.parse(extra) : {};
      if (config.adapterType && this.adapters.has(config.adapterType)) {
        return this.adapters.get(config.adapterType)!;
      }
    } catch {}

    if (loginMode === 'semi-auto') {
      // Semi-auto doesn't need a full adapter; pre-fill is handled separately
      return this.adapters.get('generic-form')!;
    }

    // Auto-detect: probe the target
    const base = targetUrl.replace(/\/+$/, '');

    // Check for PocketBase
    try {
      const res = await fetch(`${base}/api/health`, { method: 'GET' });
      if (res.ok) {
        const body = await res.json();
        if (body.code === 200 || body.message === 'API is healthy.') {
          this.logger.log(`Detected PocketBase at ${base}`);
          return this.adapters.get('pocketbase')!;
        }
      }
    } catch {}

    // Check for Certd (has specific API paths)
    try {
      const res = await fetch(`${base}/api/sys/authority/login`, {
        method: 'OPTIONS',
      });
      if (res.status !== 404) {
        this.logger.log(`Detected Certd-like system at ${base}`);
        return this.adapters.get('certd')!;
      }
    } catch {}

    // Fallback to generic form
    this.logger.log(`Using generic-form adapter for ${base}`);
    return this.adapters.get('generic-form')!;
  }
}
