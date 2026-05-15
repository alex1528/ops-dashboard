import { Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
declare class LoginDto {
    username: string;
    password: string;
    mfaCode?: string;
}
export declare class AuthController {
    private auth;
    private prisma;
    constructor(auth: AuthService, prisma: PrismaService);
    login(dto: LoginDto): Promise<{
        mfaRequired: boolean;
        message: string;
        access_token?: undefined;
        user?: undefined;
    } | {
        access_token: string;
        user: {
            id: string;
            username: string;
            role: string;
            email: string;
            mfaEnabled: boolean;
        };
        mfaRequired?: undefined;
        message?: undefined;
    }>;
    me(req: Request): Promise<any>;
}
export {};
