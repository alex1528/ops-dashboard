import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateUserPermissionsDto } from './users.dto';
import { AuditService } from '../audit/audit.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(
    private users: UsersService,
    private audit: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    const result = await this.users.create(dto);
    await this.audit.log(req.user?.id, 'user.create', result.id, dto.username, req.ip);
    return result;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    const result = await this.users.update(id, dto);
    // 区分审计动作：携带 password 视为重置密码，记录 user.reset_password
    const action = dto.password ? 'user.reset_password' : 'user.update';
    await this.audit.log(req.user?.id, action, id, '', req.ip);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.audit.log(req.user?.id, 'user.delete', id, '', req.ip);
    return this.users.remove(id);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.users.getPermissions(id);
  }

  @Put(':id/permissions')
  async updatePermissions(@Param('id') id: string, @Body() dto: UpdateUserPermissionsDto, @Req() req: any) {
    const result = await this.users.updatePermissions(id, dto);
    await this.audit.log(req.user?.id, 'user.update_permissions', id, '', req.ip);
    return result;
  }
}
