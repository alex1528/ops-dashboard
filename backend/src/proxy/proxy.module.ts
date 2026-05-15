import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { ProxySessionStore } from './proxy-session.store';
import { ProxyAuthGuard } from './proxy-auth.guard';
import { PocketBaseAdapter } from './adapters/pocketbase.adapter';
import { CertdAdapter } from './adapters/certd.adapter';
import { GenericFormAdapter } from './adapters/generic-form.adapter';

@Module({
  controllers: [ProxyController],
  providers: [
    ProxyService,
    ProxySessionStore,
    ProxyAuthGuard,
    PocketBaseAdapter,
    CertdAdapter,
    GenericFormAdapter,
  ],
  exports: [ProxyService, ProxySessionStore],
})
export class ProxyModule {}
