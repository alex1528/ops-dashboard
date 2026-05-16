import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto } from './resources.dto';
import { AuditService } from '../audit/audit.service';
export declare class ResourcesController {
    private resources;
    private audit;
    private readonly logger;
    constructor(resources: ResourcesService, audit: AuditService);
    findAll(): Promise<{
        credential: {
            id: string;
            username: string;
            hasPassword: boolean;
            hasExtra: boolean;
        } | null;
        lastHealth: {
            error: string | null;
            id: string;
            checkedAt: Date;
            resourceId: string;
            status: string;
            statusCode: number | null;
            responseMs: number | null;
        };
        healthRecords: undefined;
        id: string;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        credential: {
            id: string;
            username: string;
            hasPassword: boolean;
            hasExtra: boolean;
        } | null;
        healthRecords: {
            error: string | null;
            id: string;
            checkedAt: Date;
            resourceId: string;
            status: string;
            statusCode: number | null;
            responseMs: number | null;
        }[];
        id: string;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getCredential(id: string, req: any): Promise<{
        exists: boolean;
        username: string;
        password: string;
        extra: string;
    }>;
    create(dto: CreateResourceDto, req: any): Promise<{
        credential: {
            id: string;
            username: string;
            hasPassword: boolean;
            hasExtra: boolean;
        } | null;
        healthRecords: {
            error: string | null;
            id: string;
            checkedAt: Date;
            resourceId: string;
            status: string;
            statusCode: number | null;
            responseMs: number | null;
        }[];
        id: string;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, dto: UpdateResourceDto, req: any): Promise<{
        credential: {
            id: string;
            username: string;
            hasPassword: boolean;
            hasExtra: boolean;
        } | null;
        healthRecords: {
            error: string | null;
            id: string;
            checkedAt: Date;
            resourceId: string;
            status: string;
            statusCode: number | null;
            responseMs: number | null;
        }[];
        id: string;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string, req: any): Promise<{
        deleted: boolean;
    }>;
}
