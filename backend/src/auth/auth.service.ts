import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { verifySync } from 'otplib';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(username: string, password: string, mfaCode?: string) {
    const user = await this.validateUser(username, password);

    // MFA verification
    if (user.mfaEnabled && user.mfaSecret) {
      if (!mfaCode) {
        return { mfaRequired: true, message: '请输入 MFA 验证码' };
      }
      const valid = verifySync({ token: mfaCode, secret: user.mfaSecret });
      if (!valid) throw new BadRequestException('MFA 验证码错误');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, username: user.username, role: user.role, email: user.email, mfaEnabled: user.mfaEnabled },
    };
  }
}
