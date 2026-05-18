import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, Req, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto, ReorderGroupsDto, ReorderResourcesDto, ClearCredentialFieldsDto } from './resources.dto';
import { AuditService } from '../audit/audit.service';

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  private readonly logger = new Logger(ResourcesController.name);

  constructor(
    private resources: ResourcesService,
    private audit: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.resources.findAll();
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resources.findOne(id);
  }

  @Get(':id/credential')
  async getCredential(@Param('id') id: string, @Req() req: any) {
    try {
      await this.audit.log(req.user?.id, 'credential.view', id, '', req.ip);
      const result = await this.resources.getDecryptedCredential(id);
      return result;
    } catch (err) {
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
    const result = await this.resources.create(dto);
    await this.audit.log(req.user?.id, 'resource.create', result.id, dto.name, req.ip);
    return result;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateResourceDto, @Req() req: any) {
    const result = await this.resources.update(id, dto);
    await this.audit.log(req.user?.id, 'resource.update', id, '', req.ip);
    return result;
  }

  @Post(':id/credential/clear')
  async clearCredential(@Param('id') id: string, @Body() dto: ClearCredentialFieldsDto, @Req() req: any) {
    const result = await this.resources.clearCredentialFields(id, dto);
    await this.audit.log(req.user?.id, 'credential.clear', id, `field=${dto.field}`, req.ip);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.audit.log(req.user?.id, 'resource.delete', id, '', req.ip);
    return this.resources.remove(id);
  }
}
