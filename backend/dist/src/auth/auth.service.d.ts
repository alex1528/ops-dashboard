import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    private jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    validateUser(username: string, password: string): Promise<{
        id: string;
        username: string;
        password: string;
        email: string;
        role: string;
        mfaSecret: string;
        mfaEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    login(username: string, password: string, mfaCode?: string): Promise<{
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
}
