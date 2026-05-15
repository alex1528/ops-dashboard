import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { MailService } from './mail.service';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

class SendMailDto {
  @IsEmail() @IsNotEmpty() to!: string;
  @IsString() @IsNotEmpty() subject!: string;
  @IsString() @IsNotEmpty() body!: string;
}

@Controller('mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MailController {
  constructor(private mail: MailService) {}

  @Post('send')
  async send(@Body() dto: SendMailDto) {
    return this.mail.sendNotification(dto.to, dto.subject, dto.body);
  }

  @Post('test')
  async test(@Req() req: any) {
    const configured = this.mail.isConfigured;
    if (!configured) return { configured: false, message: 'SMTP 未配置' };
    return { configured: true, message: 'SMTP 已配置' };
  }
}
