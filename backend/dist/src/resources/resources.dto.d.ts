export declare class CreateResourceDto {
    name: string;
    url: string;
    group?: string;
    loginMode?: string;
    description?: string;
    sortOrder?: number;
    healthCheckEnabled?: boolean;
    credUsername?: string;
    credPassword?: string;
    credExtra?: string;
}
export declare class UpdateResourceDto {
    name?: string;
    url?: string;
    group?: string;
    loginMode?: string;
    description?: string;
    sortOrder?: number;
    enabled?: boolean;
    healthCheckEnabled?: boolean;
    credUsername?: string;
    credPassword?: string;
    credExtra?: string;
}
