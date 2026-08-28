import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { OidcService } from './oidc.service';

@Controller('oidc')
export class OidcController {
  constructor(private oidc: OidcService) {}

  /**
   * GET /api/oidc/status
   * Returns whether OIDC login is available (public, no auth needed)
   */
  @Get('status')
  status() {
    return { enabled: this.oidc.isEnabled };
  }

  /**
   * GET /api/oidc/login
   * Redirects user to Authentik authorization endpoint
   */
  @Get('login')
  login(@Res() res: Response) {
    if (!this.oidc.isEnabled) {
      return res.status(501).json({ message: 'OIDC not configured' });
    }
    const state = this.oidc.generateState();
    // Store state in cookie for CSRF protection
    res.cookie('oidc_state', state, {
      httpOnly: true,
      secure: true, // HTTPS 环境必须设置
      maxAge: 600_000, // 10 minutes
      sameSite: 'lax',
      path: '/',
    });
    const url = this.oidc.getAuthorizationUrl(state);
    return res.redirect(url);
  }

  /**
   * GET /api/oidc/callback
   * Handles Authentik callback, exchanges code, issues JWT,
   * then redirects to frontend with token in query.
   *
   * 所有异常均通过重定向到前端错误页面处理，避免用户看到 JSON 错误。
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.OIDC_FRONTEND_URL || '';
    const errorRedirect = (msg: string) => {
      const base = frontendUrl || '';
      return res.redirect(`${base}/oidc/callback?error=${encodeURIComponent(msg)}`);
    };

    try {
      if (!code) {
        return errorRedirect('缺少授权码，请重试');
      }

      // Validate state (CSRF protection)
      const storedState = req.cookies?.['oidc_state'];
      if (!storedState || storedState !== state) {
        return errorRedirect('状态验证失败（Cookie 丢失），请重试');
      }
      res.clearCookie('oidc_state', { path: '/' });

      const ip = req.ip ?? '';
      const result = await this.oidc.handleCallback(code, ip);

      // Redirect to frontend callback page with JWT token
      const redirectTo = frontendUrl
        ? `${frontendUrl}/oidc/callback?token=${result.token}`
        : `/oidc/callback?token=${result.token}`;

      return res.redirect(redirectTo);
    } catch (err: any) {
      const msg = err?.message || 'OIDC 登录处理失败';
      return errorRedirect(msg);
    }
  }
}
