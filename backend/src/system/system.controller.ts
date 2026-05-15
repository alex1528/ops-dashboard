import { Controller, Get } from '@nestjs/common';
import { execSync } from 'child_process';

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
        try {
          const tag = execSync('git describe --tags --abbrev=0', {
            encoding: 'utf-8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();
          this.cachedVersion = tag || 'dev';
        } catch {
          this.cachedVersion = 'dev';
        }
      }
    }
    return { version: this.cachedVersion };
  }
}
