import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { CreateResourceDto, UpdateResourceDto } from './resources.dto';
export declare class ResourcesService {
    private prisma;
    private crypto;
    constructor(prisma: PrismaService, crypto: CryptoService);
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
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        healthCheckEnabled: boolean;
        enabled: boolean;
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
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        healthCheckEnabled: boolean;
        enabled: boolean;
    }>;
    getDecryptedCredential(resourceId: string): Promise<{
        username: string;
        password: string;
        extra: string;
    } | null>;
    create(dto: CreateResourceDto): Promise<{
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
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        healthCheckEnabled: boolean;
        enabled: boolean;
    }>;
    update(id: string, dto: UpdateResourceDto): Promise<{
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
        createdAt: Date;
        updatedAt: Date;
        name: string;
        url: string;
        group: string;
        loginMode: string;
        description: string;
        sortOrder: number;
        healthCheckEnabled: boolean;
        enabled: boolean;
    }>;
    remove(id: string): Promise<{
        deleted: boolean;
    }>;
}
