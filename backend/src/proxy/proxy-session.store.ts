import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface ProxySessionInfo {
  userId: string;
  resourceId: string;
  expiresAt: number;
}

/**
 * In-memory store for proxy session tokens.
 * When the user successfully calls /launch, a short-lived token is generated
 * and set as an httpOnly cookie so that new-tab proxy navigation works
 * without requiring a JWT Bearer header.
 */
@Injectable()
export class ProxySessionStore implements OnModuleDestroy {
  private sessions = new Map<string, ProxySessionInfo>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Periodically purge expired sessions regardless of session count
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  /** Create a new proxy session token (30-min TTL) */
  create(userId: string, resourceId: string, ttlMs = 30 * 60 * 1000): string {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, {
      userId,
      resourceId,
      expiresAt: Date.now() + ttlMs,
    });
    return token;
  }

  /** Validate a token (returns session info or null) */
  validate(token: string): ProxySessionInfo | null {
    const info = this.sessions.get(token);
    if (!info) return null;
    if (info.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return info;
  }

  /** Remove all expired entries */
  private cleanup() {
    const now = Date.now();
    for (const [k, v] of this.sessions) {
      if (v.expiresAt < now) this.sessions.delete(k);
    }
  }
}
