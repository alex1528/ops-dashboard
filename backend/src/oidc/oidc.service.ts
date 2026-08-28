import { Injectable, OnModuleInit, Logger, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

/**
 * OIDC 配置接口
 */
interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  adminGroup: string; // Authentik group name that maps to admin role
  scopes: string;
}

/**
 * OIDC 发现文档缓存
 */
interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

@Injectable()
export class OidcService implements OnModuleInit {
  private readonly logger = new Logger(OidcService.name);
  private config: OidcConfig | null = null;
  private discovery: OidcDiscovery | null = null;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async onModuleInit() {
    const issuer = process.env.OIDC_ISSUER;
    if (!issuer) {
      this.logger.warn('OIDC_ISSUER not configured — OIDC login disabled');
      return;
    }
    this.config = {
      issuer,
      clientId: process.env.OIDC_CLIENT_ID || '',
      clientSecret: process.env.OIDC_CLIENT_SECRET || '',
      redirectUri: process.env.OIDC_REDIRECT_URI || '',
      adminGroup: process.env.OIDC_ADMIN_GROUP || 'ops-admin',
      scopes: process.env.OIDC_SCOPES || 'openid profile email',
    };
    // Fetch discovery document
    try {
      const wellKnownUrl = `${this.config.issuer}/.well-known/openid-configuration`;
      const resp = await fetch(wellKnownUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.discovery = await resp.json() as OidcDiscovery;
      this.logger.log(`OIDC discovery loaded from ${wellKnownUrl}`);
    } catch (err) {
      this.logger.error(`Failed to fetch OIDC discovery: ${err}`);
      this.config = null;
    }
  }

  /** Whether OIDC is properly configured and available */
  get isEnabled(): boolean {
    return !!(this.config && this.discovery);
  }

  /**
   * Generate authorization URL with state & nonce
   */
  getAuthorizationUrl(state: string): string {
    if (!this.config || !this.discovery) {
      throw new InternalServerErrorException('OIDC not configured');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes,
      state,
    });
    return `${this.discovery.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens, fetch userinfo,
   * find or create local user, issue JWT.
   */
  async handleCallback(code: string, ip: string): Promise<{ token: string; user: any }> {
    if (!this.config || !this.discovery) {
      throw new InternalServerErrorException('OIDC not configured');
    }

    // 1. Exchange code for tokens
    const tokenResp = await fetch(this.discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text();
      this.logger.error(`OIDC token exchange failed: ${errBody}`);
      throw new InternalServerErrorException('OIDC token exchange failed');
    }

    const tokenData = await tokenResp.json() as { access_token: string; id_token?: string };

    // 2. Fetch userinfo
    const userinfoResp = await fetch(this.discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResp.ok) {
      throw new InternalServerErrorException('Failed to fetch OIDC userinfo');
    }

    const userinfo = await userinfoResp.json() as {
      sub: string;
      preferred_username?: string;
      email?: string;
      name?: string;
      groups?: string[];
    };

    // 3. Determine role from groups
    const groups: string[] = userinfo.groups || [];
    const role = groups.includes(this.config.adminGroup) ? 'admin' : 'user';

    // 4. Find or create local user
    let user = await this.prisma.adminUser.findFirst({
      where: { oidcSub: userinfo.sub },
    });

    if (!user) {
      // Try matching by username or email
      const username = userinfo.preferred_username || userinfo.email || userinfo.sub;
      user = await this.prisma.adminUser.findFirst({
        where: {
          OR: [
            { username },
            ...(userinfo.email ? [{ email: userinfo.email }] : []),
          ],
        },
      });

      if (user) {
        // Link existing user to OIDC
        user = await this.prisma.adminUser.update({
          where: { id: user.id },
          data: { oidcSub: userinfo.sub, role },
        });
      } else {
        // Auto-create new user
        user = await this.prisma.adminUser.create({
          data: {
            username: userinfo.preferred_username || userinfo.sub,
            email: userinfo.email || '',
            password: '', // OIDC users have no local password
            oidcSub: userinfo.sub,
            role,
            activated: true,
            mustChangePassword: false,
            mustSetupMfa: false,
            mfaEnabled: false,
          },
        });
        this.logger.log(`Auto-created OIDC user: ${user.username} (role=${role})`);
      }
    } else {
      // Update role on each login based on current groups
      if (user.role !== role) {
        user = await this.prisma.adminUser.update({
          where: { id: user.id },
          data: { role },
        });
      }
    }

    // 5. Ensure OIDC users always bypass force-change/MFA
    if (user.mustChangePassword || user.mustSetupMfa) {
      user = await this.prisma.adminUser.update({
        where: { id: user.id },
        data: { mustChangePassword: false, mustSetupMfa: false },
      });
    }

    // 6. Sign local JWT
    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwt.sign(payload);

    await this.audit.log(user.id, 'auth.oidc_login', user.id, `groups=${groups.join(',')}`, ip);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
        mustChangePassword: user.mustChangePassword,
        mustSetupMfa: user.mustSetupMfa,
      },
    };
  }

  /** Generate a random state string */
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}
