import { LoginAdapter, AuthResult } from './login-adapter.interface';
export declare class GenericFormAdapter implements LoginAdapter {
    readonly type = "generic-form";
    private readonly logger;
    authenticate(targetUrl: string, username: string, password: string, extra: string): Promise<AuthResult | null>;
    injectAuth(headers: Record<string, string | string[]>, auth: AuthResult): void;
    rewriteHtml(html: string, auth: AuthResult): string | null;
}
