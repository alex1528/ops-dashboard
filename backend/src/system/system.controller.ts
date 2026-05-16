import { Controller, Get } from '@nestjs/common';
import { execSync, ExecSyncOptions } from 'child_process';
import * as path from 'path';

@Controller('system')
export class SystemController {
  private cachedVersion: string | null = null;

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
        try {
          const tag = execSync('git describe --tags --abbrev=0', execOpts)
            .toString()
            .trim();
          this.cachedVersion = tag || 'dev';
        } catch {
          // 若 git describe 失败，尝试通过 git tag 获取最新标签
          try {
            const tags = execSync('git tag --sort=-v:refname', execOpts)
              .toString()
              .trim();
            const latest = tags.split('\n')[0]?.trim();
            this.cachedVersion = latest || 'dev';
          } catch {
            this.cachedVersion = 'dev';
          }
        }
      }
    }
    return { version: this.cachedVersion };
  }
}
