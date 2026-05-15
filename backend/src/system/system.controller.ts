import { Controller, Get } from '@nestjs/common';
import { execSync } from 'child_process';

@Controller('system')
export class SystemController {
  private cachedVersion: string | null = null;

  @Get('version')
  getVersion() {
    if (!this.cachedVersion) {
      try {
        // Get latest tag from git
        const tag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo "dev"', {
          encoding: 'utf-8',
          timeout: 3000,
        }).trim();
        this.cachedVersion = tag || 'dev';
      } catch {
        this.cachedVersion = 'dev';
      }
    }
    return { version: this.cachedVersion };
  }
}
