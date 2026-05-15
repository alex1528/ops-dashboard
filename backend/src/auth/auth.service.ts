import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

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
    return { id: user.id, username: user.username };
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    const payload = { sub: user.id, username: user.username };
    return { access_token: this.jwt.sign(payload), user };
  }
}
