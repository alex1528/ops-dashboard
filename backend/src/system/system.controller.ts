import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { execSync, ExecSyncOptions } from 'child_process';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { SystemService } from './system.service';

@Controller('system')
export class SystemController {
  private cachedVersion: string | null = null;

  constructor(private systemService: SystemService) {}

  @Get('version')
  getVersion() {
    if (!this.cachedVersion) {
      // 1. Prefer APP_VERSION env (injected during Docker build)
      if (process.env.APP_VERSION) {
        this.cachedVersion = process.env.APP_VERSION;
      } else {
        // 2. Fallback: read git tag at runtime (local dev)
        // 使用 shell + cwd 确保 Windows/macOS/Linux 均能正确定位 git
        const repoRoot = path.resolve(__dirname, '..', '..', '..');
        const execOpts: ExecSyncOptions = {
          timeout: 3000,
          cwd: repoRoot,
          shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
          stdio: ['pipe', 'pipe', 'pipe'],
        };
        // 优先按版本号倒序取最新的语义化 tag（与 build.sh / build.ps1 / post-commit
        // 钩子保持一致）。这样可避免 `git describe` 在多分支/sibling tag 场景下选到
        try {
          const tags = execSync(
            'git tag -l "v[0-9]*.[0-9]*.[0-9]*" --sort=-version:refname',
            execOpts,
          )
            .toString()
            .trim();
          const latest = tags.split('\n')[0]?.trim();
          if (latest) {
            this.cachedVersion = latest;
          }
        } catch {
          // 忽略，进入下一级回退
        }

        // 回退 1：git describe（最近可达 tag）
        if (!this.cachedVersion) {
          try {
            const tag = execSync('git describe --tags --abbrev=0', execOpts)
              .toString()
              .trim();
            if (tag) {
              this.cachedVersion = tag;
            }
          } catch {
            // 忽略，进入下一级回退
          }
        }

        // 回退 2：放宽版本格式过滤，仍按语义化版本排序
        if (!this.cachedVersion) {
          try {
            const tags = execSync('git tag --sort=-v:refname', execOpts)
              .toString()
              .trim();
            const latest = tags.split('\n')[0]?.trim();
            if (latest) {
              this.cachedVersion = latest;
            }
          } catch {
            // 忽略
          }
        }

        if (!this.cachedVersion) {
          this.cachedVersion = 'dev';
        }
      }
    }
    return { version: this.cachedVersion };
  }

  /** Public: check if registration is allowed */
  @Get('settings/allow_registration')
  async getAllowRegistration() {
    const value = await this.systemService.getSetting('allow_registration');
    return { allowRegistration: value === 'true' };
  }

  /** Admin only: toggle registration setting */
  @Put('settings/allow_registration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setAllowRegistration(@Body() body: { allowRegistration: boolean }) {
    await this.systemService.setSetting('allow_registration', String(!!body.allowRegistration));
    return { allowRegistration: !!body.allowRegistration };
  }
}
