import {
  Controller, Get, Param, Req, Res, UseGuards, All, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProxyAuthGuard } from './proxy-auth.guard';
import { ProxyService } from './proxy.service';
import { ProxySessionStore } from './proxy-session.store';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(
    private proxyService: ProxyService,
    private sessionStore: ProxySessionStore,
    private audit: AuditService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /api/proxy/:id/launch
   * Attempts auto-login and redirects to the target through the proxy,
   * or opens the target directly if auto-login fails.
   */
  @Get(':id/launch')
  @UseGuards(JwtAuthGuard)
  async launch(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: { credential: true },
    });
    if (!resource) {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }

    await this.audit.log((req as any).user?.id, 'proxy.launch', id, resource.name, req.ip);

    // Check if web auto-login is enabled for this resource
    if (!resource.credential?.webLoginEnabled) {
      // Direct link mode — just open target URL
      res.json({
        mode: 'link',
        targetUrl: resource.url,
      });
      return;
    }

    // Auto mode: try to get/create session
    const session = await this.proxyService.getSession(id);
    if (!session) {
      this.logger.warn(`Auto-login failed for ${resource.name}, falling back to direct link`);
      res.json({
        mode: 'fallback',
        targetUrl: resource.url,
        error: '自动登录失败，将以直链方式打开',
      });
      return;
    }

    // Create proxy session token and set as httpOnly cookie
    const userId = (req as any).user?.id || 'unknown';
    const proxyToken = this.sessionStore.create(userId, id);
    res.cookie('ops_proxy_session', proxyToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: `/api/proxy/${id}`,
      maxAge: 30 * 60 * 1000, // 30 min
    });

    // Return proxy entry point for the frontend to navigate to
    res.json({
      mode: 'auto',
      proxyUrl: `/api/proxy/${id}/`,
      targetUrl: resource.url,
    });
  }

  /**
   * ALL /api/proxy/:id  and  /api/proxy/:id/*
   * Reverse proxy: forwards all requests to the target system with
   * authentication injected.
   */
  @All(':id')
  @UseGuards(ProxyAuthGuard)
  async proxyRoot(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.proxyRequest(id, '', req, res);
  }

  @All(':id/*path')
  @UseGuards(ProxyAuthGuard)
  async proxyRequest(
    @Param('id') id: string,
    @Param('path') path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const session = await this.proxyService.getSession(id);
    if (!session) {
      res.status(502).json({ error: 'Unable to establish authenticated session with target' });
      return;
    }

    const { authResult, adapter, targetUrl } = session;
    const base = targetUrl.replace(/\/+$/, '');
    const targetPath = '/' + (path || '');
    const targetFullUrl = `${base}${targetPath}`;

    try {
      // Build proxied request headers
      const proxyHeaders: Record<string, string> = {};
      // Forward select original headers
      for (const key of ['accept', 'accept-language', 'content-type', 'content-length']) {
        if (req.headers[key]) {
          proxyHeaders[key] = req.headers[key] as string;
        }
      }
      // Let adapter inject auth
      adapter.injectAuth(proxyHeaders, authResult);

      // Forward the request to target
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: proxyHeaders,
        signal: controller.signal,
        redirect: 'manual',
      };

      // Forward body for non-GET requests
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          (fetchOptions as any).body = Buffer.concat(chunks);
        }
      }

      const targetRes = await fetch(targetFullUrl, fetchOptions);
      clearTimeout(timer);

      // Handle redirects — rewrite Location header to stay within proxy
      if (targetRes.status >= 300 && targetRes.status < 400) {
        const location = targetRes.headers.get('location');
        if (location) {
          let rewritten = location;
          // If absolute URL pointing to target, rewrite to proxy path
          if (location.startsWith(base)) {
            rewritten = `/api/proxy/${id}${location.slice(base.length)}`;
          } else if (location.startsWith('/')) {
            rewritten = `/api/proxy/${id}${location}`;
          }
          res.redirect(targetRes.status, rewritten);
          return;
        }
      }

      // Copy response headers
      const skipHeaders = new Set(['transfer-encoding', 'content-encoding', 'content-security-policy']);
      targetRes.headers.forEach((value, key) => {
        if (!skipHeaders.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      // Rewrite HTML responses if adapter supports it
      const contentType = targetRes.headers.get('content-type') || '';
      if (contentType.includes('text/html') && adapter.rewriteHtml) {
        const html = await targetRes.text();
        const rewritten = adapter.rewriteHtml(html, authResult, targetUrl);
        const finalHtml = rewritten || html;

        // Rewrite absolute URLs in HTML to proxy paths
        const rewrittenHtml = this.rewriteUrls(finalHtml, base, id);

        res.setHeader('content-type', contentType);
        res.status(targetRes.status).send(rewrittenHtml);
        return;
      }

      // Stream other content types directly
      res.status(targetRes.status);
      if (targetRes.body) {
        const reader = targetRes.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err: any) {
      this.logger.error(`Proxy error for ${id}: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Proxy error', detail: err.message });
      }
    }
  }

  /**
   * Rewrite absolute target URLs in HTML to go through the proxy.
   */
  private rewriteUrls(html: string, targetBase: string, resourceId: string): string {
    // Replace absolute URLs like http://192.168.x.x:8090/...
    // with /api/proxy/{id}/...
    const escaped = targetBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    let rewritten = html.replace(regex, `/api/proxy/${resourceId}`);

    // Also rewrite root-relative paths like /assets/... to /api/proxy/{id}/assets/...
    // Match href="/..." and src="/..." but not href="//" (protocol-relative URLs)
    rewritten = rewritten.replace(
      /(href|src)=(["'])\/(?!\/|api\/proxy\/)/g,
      `$1=$2/api/proxy/${resourceId}/`
    );

    return rewritten;
  }
}
