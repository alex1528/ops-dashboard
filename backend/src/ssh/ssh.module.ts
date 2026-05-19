import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SshGateway } from './ssh.gateway';
import { SshService } from './ssh.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    AuditModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any },
    }),
  ],
  providers: [SshGateway, SshService],
})
export class SshModule {}
