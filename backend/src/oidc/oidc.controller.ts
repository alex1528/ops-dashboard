import { Controller, Get, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
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
      maxAge: 600_000, // 10 minutes
      sameSite: 'lax',
    });
    const url = this.oidc.getAuthorizationUrl(state);
    return res.redirect(url);
  }

  /**
   * GET /api/oidc/callback
   * Handles Authentik callback, exchanges code, issues JWT,
   * then redirects to frontend with token in query.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      throw new UnauthorizedException('Missing authorization code');
    }

    // Validate state
    const storedState = req.cookies?.['oidc_state'];
    if (!storedState || storedState !== state) {
      throw new UnauthorizedException('Invalid OIDC state — possible CSRF');
    }
    res.clearCookie('oidc_state');

    const ip = req.ip ?? '';
    const result = await this.oidc.handleCallback(code, ip);

    // Redirect to frontend callback page with JWT token
    const frontendUrl = process.env.OIDC_FRONTEND_URL || '';
    const redirectTo = frontendUrl
      ? `${frontendUrl}/oidc/callback?token=[REDACTED_PARAM]${encodeURIComponent(result.token)}`
      : `/oidc/callback?token=[REDACTED_PARAM]${encodeURIComponent(result.token)}`;

    return res.redirect(redirectTo);
  }
}
