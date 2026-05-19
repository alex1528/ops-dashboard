import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResourcesModule } from './resources/resources.module';
import { HealthCheckModule } from './health-check/health-check.module';
import { AuditModule } from './audit/audit.module';
import { CryptoModule } from './crypto/crypto.module';
import { ProxyModule } from './proxy/proxy.module';
import { BackupModule } from './backup/backup.module';
import { UsersModule } from './users/users.module';
import { MfaModule } from './mfa/mfa.module';
import { MailModule } from './mail/mail.module';
import { SystemModule } from './system/system.module';
import { SshModule } from './ssh/ssh.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      exclude: ['/api/{*path}'],
    }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ResourcesModule,
    HealthCheckModule,
    AuditModule,
    ProxyModule,
    BackupModule,
    UsersModule,
    MfaModule,
    MailModule,
    SystemModule,
    SshModule,
  ],
})
export class AppModule {}
