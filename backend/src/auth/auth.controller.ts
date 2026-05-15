import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

class LoginDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsString() @IsOptional() mfaCode?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password, dto.mfaCode);
  }

  /** Used by the frontend to verify a stored token is still valid */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const u = (req as any).user;
    const user = await this.prisma.adminUser.findUnique({ where: { id: u.id } });
    if (!user) return u;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      mfaEnabled: user.mfaEnabled,
    };
  }
}
