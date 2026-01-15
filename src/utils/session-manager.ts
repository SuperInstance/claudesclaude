import type { Session, SessionType } from '../core/types.js';

export interface SessionManagerOptions {
  maxCacheSize?: number;
  sessionTTL?: number;
  enableMetrics?: boolean;
}

export interface SessionManagerMetrics {
  totalSessions: number;
  activeSessions: number;
  sessionsCreated: number;
  sessionsDeleted: number;
  sessionsUpdated: number;
  averageSessionLifetime: number;
  memoryUsage: number;
}

export class OptimizedSessionManager {
  private sessions = new Map<string, Session>();
  private options: Required<SessionManagerOptions>;
  private metrics: SessionManagerMetrics;
  private creationTimes = new Map<string, number>();

  constructor(options: SessionManagerOptions = {}) {
    this.options = {
      maxCacheSize: 1000,
      sessionTTL: 30 * 60 * 1000, // 30 minutes
      enableMetrics: true,
      ...options
    };

    this.metrics = this.initializeMetrics();
  }

  addSession(session: Session): void {
    this.sessions.set(session.id, session);
    this.creationTimes.set(session.id, Date.now());

    if (this.options.enableMetrics) {
      this.metrics.sessionsCreated++;
      this.metrics.totalSessions++;
    }

    // Check if we need to cleanup old sessions
    if (this.sessions.size > this.options.maxCacheSize) {
      this.cleanupSessions();
    }
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  updateSession(id: string, updates: Partial<Session>): boolean {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates);
      session.updatedAt = new Date();

      if (this.options.enableMetrics) {
        this.metrics.sessionsUpdated++;
      }
      return true;
    }
    return false;
  }

  removeSession(id: string): boolean {
    const deleted = this.sessions.delete(id);
    this.creationTimes.delete(id);

    if (deleted && this.options.enableMetrics) {
      this.metrics.sessionsDeleted++;
      this.metrics.totalSessions = Math.max(0, this.metrics.totalSessions - 1);
    }

    return deleted;
  }

  getSessionsByType(type: SessionType): Session[] {
    return this.getAllSessions().filter(session => session.type === type);
  }

  getActiveSessions(): Session[] {
    return this.getAllSessions().filter(session => session.status === 'active');
  }

  getSessionsByWorkspace(workspace: string): Session[] {
    return this.getAllSessions().filter(session => session.workspace === workspace);
  }

  cleanupSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      // Clean up expired sessions
      if (this.options.sessionTTL && now - (this.creationTimes.get(id) || now) > this.options.sessionTTL) {
        this.sessions.delete(id);
        this.creationTimes.delete(id);
        cleaned++;
        continue;
      }

      // Clean up completed or failed sessions
      if (session.status === 'completed' || session.status === 'failed') {
        this.sessions.delete(id);
        this.creationTimes.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0 && this.options.enableMetrics) {
      this.metrics.totalSessions = Math.max(0, this.metrics.totalSessions - cleaned);
    }
  }

  getMetrics(): SessionManagerMetrics {
    if (!this.options.enableMetrics) {
      return this.initializeMetrics();
    }

    // Update metrics
    this.metrics.totalSessions = this.sessions.size;
    this.metrics.activeSessions = this.getActiveSessions().length;
    this.memoryUsage = this.calculateMemoryUsage();

    // Calculate average session lifetime
    let totalLifetime = 0;
    let validSessions = 0;
    const now = Date.now();

    for (const [id, creationTime] of this.creationTimes.entries()) {
      const session = this.sessions.get(id);
      if (session) {
        const lifetime = now - creationTime;
        totalLifetime += lifetime;
        validSessions++;
      }
    }

    this.metrics.averageSessionLifetime = validSessions > 0 ? totalLifetime / validSessions : 0;

    return { ...this.metrics };
  }

  private calculateMemoryUsage(): number {
    // Simple memory estimation
    const baseMemory = this.sessions.size * 1024; // 1KB per session base
    const configMemory = this.sessions.size * 512; // 512B per config
    return baseMemory + configMemory;
  }

  private initializeMetrics(): SessionManagerMetrics {
    return {
      totalSessions: 0,
      activeSessions: 0,
      sessionsCreated: 0,
      sessionsDeleted: 0,
      sessionsUpdated: 0,
      averageSessionLifetime: 0,
      memoryUsage: 0
    };
  }

  shutdown(): void {
    this.sessions.clear();
    this.creationTimes.clear();
    this.metrics = this.initializeMetrics();
  }

  getSessionStats() {
    const sessions = this.getAllSessions();
    const typeStats = sessions.reduce((acc, session) => {
      acc[session.type] = (acc[session.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusStats = sessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: sessions.length,
      byType: typeStats,
      byStatus: statusStats,
      uniqueWorkspaces: new Set(sessions.map(s => s.workspace)).size
    };
  }
}