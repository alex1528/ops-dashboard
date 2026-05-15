import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { ProxySessionStore } from './proxy-session.store';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class ProxyController {
    private proxyService;
    private sessionStore;
    private audit;
    private prisma;
    private readonly logger;
    constructor(proxyService: ProxyService, sessionStore: ProxySessionStore, audit: AuditService, prisma: PrismaService);
    launch(id: string, req: Request, res: Response): Promise<void>;
    prefill(id: string, req: Request, res: Response): Promise<void>;
    proxyRoot(id: string, req: Request, res: Response): Promise<void>;
    proxyRequest(id: string, path: string, req: Request, res: Response): Promise<void>;
    private rewriteUrls;
}
