import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto } from './resources.dto';
import { AuditService } from '../audit/audit.service';
export declare class ResourcesController {
    private resources;
    private audit;
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
            status: string;
            checkedAt: Date;
            resourceId: string;
            statusCode: number | null;
            responseMs: number | null;
        };
        healthRecords: undefined;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
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
            status: string;
            checkedAt: Date;
            resourceId: string;
            statusCode: number | null;
            responseMs: number | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
    }>;
    getCredential(id: string, req: any): Promise<{
        username: string;
        password: string;
        extra: string;
    } | null>;
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
            status: string;
            checkedAt: Date;
            resourceId: string;
            statusCode: number | null;
            responseMs: number | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
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
            status: string;
            checkedAt: Date;
            resourceId: string;
            statusCode: number | null;
            responseMs: number | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        enabled: boolean;
        healthCheckEnabled: boolean;
    }>;
    remove(id: string, req: any): Promise<{
        deleted: boolean;
    }>;
}
