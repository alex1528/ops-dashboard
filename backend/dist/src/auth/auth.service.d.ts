import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    private jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    validateUser(username: string, password: string): Promise<{
        id: string;
        username: string;
    }>;
    login(username: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            username: string;
        };
    }>;
}
