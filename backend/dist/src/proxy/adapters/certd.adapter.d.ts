import { LoginAdapter, AuthResult } from './login-adapter.interface';
export declare class CertdAdapter implements LoginAdapter {
    readonly type = "certd";
    private readonly logger;
    authenticate(targetUrl: string, username: string, password: string): Promise<AuthResult | null>;
    injectAuth(headers: Record<string, string | string[]>, auth: AuthResult): void;
    rewriteHtml(html: string, auth: AuthResult): string | null;
}
