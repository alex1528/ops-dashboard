import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IsNotEmpty, IsString } from 'class-validator';

class LoginDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  /** Used by the frontend to verify a stored token is still valid */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return (req as any).user;
  }
}
