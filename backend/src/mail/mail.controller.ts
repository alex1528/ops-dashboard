import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { MailService } from './mail.service';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

class SendMailDto {
  @IsEmail() @IsNotEmpty() to!: string;
  @IsString() @IsNotEmpty() subject!: string;
  @IsString() @IsNotEmpty() body!: string;
}

class TestMailDto {
  @IsEmail() @IsNotEmpty() to!: string;
}

@Controller('mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MailController {
  constructor(private mail: MailService) {}

  /** 获取 SMTP 配置状态（不返回敏感信息） */
  @Get('status')
  getStatus() {
    return {
      configured: this.mail.isConfigured,
      host: process.env.SMTP_HOST || '',
      port: process.env.SMTP_PORT || '465',
      user: process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{2}).+(@.+)/, '$1***$2') : '',
      from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    };
  }

  @Post('send')
  async send(@Body() dto: SendMailDto) {
    return this.mail.sendNotification(dto.to, dto.subject, dto.body);
  }

  /** 发送测试邮件 */
  @Post('test')
  async test(@Body() dto: TestMailDto) {
    if (!this.mail.isConfigured) {
      return { sent: false, reason: 'SMTP 未配置，请先设置环境变量 SMTP_HOST / SMTP_USER / SMTP_PASS' };
    }
    return this.mail.sendNotification(dto.to, '测试邮件', '<p>这是一封来自 Ops Dashboard 的测试邮件，收到说明 SMTP 配置正确。</p>');
  }
}
