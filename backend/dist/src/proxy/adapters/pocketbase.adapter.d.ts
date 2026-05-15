import { LoginAdapter, AuthResult } from './login-adapter.interface';
export declare class PocketBaseAdapter implements LoginAdapter {
    readonly type = "pocketbase";
    private readonly logger;
    authenticate(targetUrl: string, username: string, password: string): Promise<AuthResult | null>;
    injectAuth(headers: Record<string, string | string[]>, auth: AuthResult): void;
    rewriteHtml(html: string, auth: AuthResult, targetUrl: string): string | null;
}
