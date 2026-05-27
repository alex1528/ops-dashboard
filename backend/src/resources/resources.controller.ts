import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, Req, HttpException, HttpStatus, Logger, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto, ReorderGroupsDto, ReorderResourcesDto, ClearCredentialFieldsDto } from './resources.dto';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  private readonly logger = new Logger(ResourcesController.name);

  constructor(
    private resources: ResourcesService,
    private audit: AuditService,
    private users: UsersService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    const all = await this.resources.findAll();
    // Admin sees everything
    if (req.user?.role === 'admin') return all;
    // Regular user sees: own resources + authorized resources
    const userId = req.user?.id;
    const perms = await this.users.getPermissions(userId);
    const allowedGroups = new Set(perms.filter((p) => p.type === 'group').map((p) => p.target));
    const allowedResources = new Set(perms.filter((p) => p.type === 'resource').map((p) => p.target));
    return all.filter((r: any) =>
      r.ownerId === userId ||
      allowedGroups.has(r.group) ||
      allowedResources.has(r.id),
    );
  }

  @Put('reorder/groups')
  async reorderGroups(@Body() dto: ReorderGroupsDto, @Req() req: any) {
    const result = await this.resources.reorderGroups(dto);
    await this.audit.log(req.user?.id, 'resource.reorder_groups', undefined, '', req.ip);
    return result;
  }

  @Put('reorder/items')
  async reorderItems(@Body() dto: ReorderResourcesDto, @Req() req: any) {
    const result = await this.resources.reorderResources(dto);
    await this.audit.log(req.user?.id, 'resource.reorder_items', undefined, '', req.ip);
    return result;
  }

  @Get('groups')
  async getGroups() {
    return this.resources.getGroups();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resources.findOne(id);
  }

  @Get(':id/credential')
  async getCredential(@Param('id') id: string, @Req() req: any) {
    try {
      // Permission check: non-admin users must own or have explicit access
      if (req.user?.role !== 'admin') {
        const hasAccess = await this.users.hasResourceAccess(req.user?.id, id);
        if (!hasAccess) throw new ForbiddenException('无权访问该资源凭据');
      }
      await this.audit.log(req.user?.id, 'credential.view', id, '', req.ip);
      const result = await this.resources.getDecryptedCredential(id);
      return result;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.error(
        `Failed to read credential for resource ${id}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new HttpException(
        { message: '凭据获取失败，请联系管理员' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async create(@Body() dto: CreateResourceDto, @Req() req: any) {
    // Regular users own their resources; admin resources have no owner
    const ownerId = req.user?.role === 'admin' ? null : req.user?.id;
    const result = await this.resources.create(dto, ownerId);
    await this.audit.log(req.user?.id, 'resource.create', result.id, dto.name, req.ip);
    return result;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateResourceDto, @Req() req: any) {
    // Non-admin permission logic
    if (req.user?.role !== 'admin') {
      const resource = await this.resources.findOneRaw(id);
      if (!resource) throw new ForbiddenException('资源不存在');
      const isOwner = resource.ownerId === req.user?.id;

      if (!isOwner) {
        // Authorized (non-owner) user: restricted credential-only access
        const hasAccess = await this.users.hasResourceAccess(req.user?.id, id);
        if (!hasAccess) throw new ForbiddenException('无权修改该资源');

        // Check if web credentials are already enabled
        const existingCred = await this.resources.getCredentialRaw(id);
        const webAlreadyEnabled = !!(existingCred && (existingCred.username || existingCred.password));

        if (webAlreadyEnabled) {
          // Web credentials already filled — no further credential modification allowed
          throw new ForbiddenException('该资源凭据已录入，无权修改');
        }

        // Strip all non-credential fields — authorized user can only set web credentials
        const allowedDto: UpdateResourceDto = {};
        if (dto.credWebEnabled !== undefined) allowedDto.credWebEnabled = dto.credWebEnabled;
        if (dto.credUsername !== undefined) allowedDto.credUsername = dto.credUsername;
        if (dto.credPassword !== undefined) allowedDto.credPassword = dto.credPassword;
        if (dto.credExtra !== undefined) allowedDto.credExtra = dto.credExtra;

        const result = await this.resources.update(id, allowedDto);
        await this.audit.log(req.user?.id, 'resource.update', id, 'credential_fill', req.ip);
        return result;
      }
    }
    const result = await this.resources.update(id, dto);
    await this.audit.log(req.user?.id, 'resource.update', id, '', req.ip);
    return result;
  }

  @Post(':id/credential/clear')
  async clearCredential(@Param('id') id: string, @Body() dto: ClearCredentialFieldsDto, @Req() req: any) {
    // Non-admin: only owners can clear credentials (authorized users cannot)
    if (req.user?.role !== 'admin') {
      const resource = await this.resources.findOneRaw(id);
      if (!resource || resource.ownerId !== req.user?.id) {
        throw new ForbiddenException('无权操作该资源凭据');
      }
    }
    const result = await this.resources.clearCredentialFields(id, dto);
    await this.audit.log(req.user?.id, 'credential.clear', id, `field=${dto.field}`, req.ip);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    // Non-admin can only delete own resources (not granted resources)
    if (req.user?.role !== 'admin') {
      const resource = await this.resources.findOne(id);
      if ((resource as any).ownerId !== req.user?.id) {
        throw new ForbiddenException('无权删除该资源');
      }
    }
    await this.audit.log(req.user?.id, 'resource.delete', id, '', req.ip);
    return this.resources.remove(id);
  }
}
