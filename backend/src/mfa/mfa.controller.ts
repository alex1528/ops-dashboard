import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MfaService } from './mfa.service';
import { AuditService } from '../audit/audit.service';
import { IsString, IsNotEmpty } from 'class-validator';

class VerifyMfaDto {
  @IsString() @IsNotEmpty() code!: string;
}

class DisableMfaDto {
  @IsString() @IsNotEmpty() password!: string;
}

@Controller('mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(
    private mfa: MfaService,
    private audit: AuditService,
  ) {}

  @Get('status')
  getStatus(@Req() req: any) {
    return this.mfa.getStatus(req.user.id);
  }

  @Post('setup')
  async setup(@Req() req: any) {
    await this.audit.log(req.user.id, 'mfa.setup', req.user.id, '', req.ip);
    return this.mfa.generateSetup(req.user.id);
  }

  @Post('verify')
  async verify(@Body() dto: VerifyMfaDto, @Req() req: any) {
    const result = await this.mfa.verifyAndEnable(req.user.id, dto.code);
    await this.audit.log(req.user.id, 'mfa.enable', req.user.id, '', req.ip);
    return result;
  }

  @Post('disable')
  async disable(@Body() dto: DisableMfaDto, @Req() req: any) {
    const result = await this.mfa.disable(req.user.id, dto.password);
    await this.audit.log(req.user.id, 'mfa.disable', req.user.id, '', req.ip);
    return result;
  }
}
