export interface AuthResult {
    data: Record<string, any>;
    expiresAt: number;
}
export interface LoginAdapter {
    readonly type: string;
    authenticate(targetUrl: string, username: string, password: string, extra: string): Promise<AuthResult | null>;
    injectAuth(proxyReqHeaders: Record<string, string | string[]>, authResult: AuthResult): void;
    rewriteHtml?(html: string, authResult: AuthResult, targetUrl: string): string | null;
}
