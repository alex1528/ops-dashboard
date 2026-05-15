/**
 * LoginAdapter interface — each target system implements one.
 *
 * Lifecycle:
 *   1. authenticate() — call target's login API, return session info
 *   2. injectAuth()   — modify outgoing proxy request with the session
 *   3. rewriteHtml()  — optionally patch HTML response to inject client-side auth
 */
export interface AuthResult {
  /** Adapter-specific session data (token, cookies, etc.) */
  data: Record<string, any>;
  /** When this session expires (epoch ms). 0 = no expiry tracking */
  expiresAt: number;
}

export interface LoginAdapter {
  /** Unique adapter type name, e.g. "pocketbase", "certd", "generic-form" */
  readonly type: string;

  /**
   * Authenticate against the target system.
   * @param targetUrl  Base URL of the target system
   * @param username   Decrypted username
   * @param password   Decrypted password
   * @param extra      Decrypted extra field (JSON string or empty)
   * @returns AuthResult with session data, or null if login failed
   */
  authenticate(
    targetUrl: string,
    username: string,
    password: string,
    extra: string,
  ): Promise<AuthResult | null>;

  /**
   * Inject authentication into a proxy request headed to the target.
   * Called on every proxied request.
   */
  injectAuth(
    proxyReqHeaders: Record<string, string | string[]>,
    authResult: AuthResult,
  ): void;

  /**
   * Optionally rewrite HTML body returned from the target.
   * Used to inject scripts (e.g. set localStorage for SPA auth).
   * Return null to skip rewriting.
   */
  rewriteHtml?(
    html: string,
    authResult: AuthResult,
    targetUrl: string,
  ): string | null;
}
