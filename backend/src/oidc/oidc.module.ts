import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OidcService } from './oidc.service';
import { OidcController } from './oidc.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any },
    }),
  ],
  controllers: [OidcController],
  providers: [OidcService],
  exports: [OidcService],
})
export class OidcModule {}
