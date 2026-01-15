/**
 * Optimized Session Manager with Memory Management
 *
 * This session manager provides:
 * - LRU caching for active sessions
 * - Automatic cleanup of expired sessions
 * - Memory limits and eviction policies
 * - Weak references for session contexts
 * - Comprehensive metrics
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Session, SessionData, SessionStatus, SessionFilter, SessionType } from '../types';
import { Logger } from './simple-logger';
import { SimpleLRUCache, createSessionCache, MemoryMetrics } from './simple-lru-cache';
import { ValidationError, SessionNotFoundError } from '../types/simple-types';

export interface SessionManagerOptions {
  logger?: Logger;
  maxSessions?: number;
  sessionTTL?: number;
  maxSize?: number;
  enableAutoCleanup?: boolean;
  cleanupIntervalMs?: number;
  enableWeakReferences?: boolean;
}

export interface SessionManagerMetrics {
  totalSessions: number;
  activeSessions: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
  sessionsCreated: number;
  sessionsDeleted: number;
  sessionsExpired: number;
  averageSessionSize: number;
  lastCleanup?: Date;
}

export class OptimizedSessionManager extends EventEmitter {
  private sessionCache: SimpleLRUCache<string, Session>;
  private logger: Logger;
  private metrics: SessionManagerMetrics;
  private options: Required<SessionManagerOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private weakReferenceSessions = new Set<string>();

  constructor(options: SessionManagerOptions = {}) {
    super();

    this.options = {
      logger: options.logger || new Logger({ level: 'info', enableConsole: true }),
      maxSessions: options.maxSessions || 1000,
      sessionTTL: options.sessionTTL || 30 * 60 * 1000, // 30 minutes
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB
      enableAutoCleanup: options.enableAutoCleanup !== false,
      cleanupIntervalMs: options.cleanupIntervalMs || 5 * 60 * 1000, // 5 minutes
      enableWeakReferences: options.enableWeakReferences || false
    };

    this.logger = this.options.logger.createChildLogger({ component: 'session-manager' });
    this.sessionCache = createSessionCache({
      max: this.options.maxSessions,
      ttl: this.options.sessionTTL,
      maxSize: this.options.maxSize
    });

    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
      sessionsCreated: 0,
      sessionsDeleted: 0,
      sessionsExpired: 0,
      averageSessionSize: 0
    };

    this.setupEventHandlers();
    this.startAutoCleanup();
  }

  /**
   * Create a new session
   */
  async createSession(sessionData: SessionData): Promise<Session> {
    const sessionId = uuidv4();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      type: sessionData.type,
      name: sessionData.name,
      status: SessionStatus.ACTIVE,
      branch: sessionData.workspace,
      workspace: sessionData.workspace,
      createdAt: now,
      lastActivity: now,
      capabilities: sessionData.capabilities || [],
      constraints: sessionData.constraints || [],
      metadata: sessionData.metadata || {}
    };

    // Add to cache
    this.sessionCache.set(sessionId, session, {
      size: this.calculateSessionSize(session),
          });

    if (this.options.enableWeakReferences) {
      this.weakReferenceSessions.add(sessionId);
    }

    // Update metrics
    this.metrics.sessionsCreated++;
    this.metrics.totalSessions++;
    this.metrics.activeSessions++;

    this.logger.debug('Session created', { sessionId, sessionType: session.type });
    this.emit('sessionCreated', session);

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // First try to get from cache
    let session = this.sessionCache.get(sessionId);

    if (session) {
      // Update last activity time
      session.lastActivity = new Date();
      // Re-set to update LRU position
      this.sessionCache.set(sessionId, session, {
        size: this.calculateSessionSize(session),
              });
      this.metrics.cacheHits++;
      return session;
    }

    this.metrics.cacheMisses++;
    this.logger.warn('Session not found in cache', { sessionId });
    return null;
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean> {
    const session = this.sessionCache.get(sessionId);
    if (!session) {
      this.logger.warn('Session not found for update', { sessionId });
      return false;
    }

    // Update session
    const updatedSession = { ...session, ...updates, lastActivity: new Date() };
    this.sessionCache.set(sessionId, updatedSession, {
      size: this.calculateSessionSize(updatedSession),
          });

    this.logger.debug('Session updated', { sessionId });
    this.emit('sessionUpdated', updatedSession);
    return true;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const deleted = this.sessionCache.delete(sessionId);
    if (deleted) {
      this.weakReferenceSessions.delete(sessionId);
      this.metrics.sessionsDeleted++;
      this.metrics.totalSessions--;
      this.metrics.activeSessions--;

      this.logger.debug('Session deleted', { sessionId });
      this.emit('sessionDeleted', { sessionId });
    }
    return deleted;
  }

  /**
   * Get sessions by status
   */
  async getSessionsByStatus(status: SessionStatus, options?: SessionFilter): Promise<Session[]> {
    const sessions: Session[] = [];

    for (const session of this.sessionCache.values()) {
      if (session.status === status) {
        sessions.push(session);
      }
    }

    // Apply filtering and sorting
    return this.applySessionFilters(sessions, options);
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<Session[]> {
    const sessions: Session[] = [];

    for (const session of this.sessionCache.values()) {
      if (session.status === SessionStatus.ACTIVE) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Get sessions by type
   */
  async getSessionsByType(type: SessionType, options?: SessionFilter): Promise<Session[]> {
    const sessions: Session[] = [];

    for (const session of this.sessionCache.values()) {
      if (session.type === type) {
        sessions.push(session);
      }
    }

    return this.applySessionFilters(sessions, options);
  }

  /**
   * Search sessions
   */
  async searchSessions(searchTerm: string, limit: number = 50): Promise<Session[]> {
    const sessions: Session[] = [];
    const term = searchTerm.toLowerCase();

    for (const session of this.sessionCache.values()) {
      if (
        session.name.toLowerCase().includes(term) ||
        session.workspace.toLowerCase().includes(term) ||
        session.id.toLowerCase().includes(term) ||
        session.type.toLowerCase().includes(term)
      ) {
        sessions.push(session);
      }
    }

    return sessions
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, limit);
  }

  /**
   * Count sessions by status
   */
  async countSessionsByStatus(): Promise<Record<SessionStatus, number>> {
    const counts = {
      [SessionStatus.ACTIVE]: 0,
      [SessionStatus.PAUSED]: 0,
      [SessionStatus.COMPLETED]: 0,
      [SessionStatus.FAILED]: 0,
      [SessionStatus.CANCELLED]: 0
    };

    for (const session of this.sessionCache.values()) {
      counts[session.status]++;
    }

    return counts;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();
    const sessionTTL = this.options.sessionTTL;

    const sessions = [];
    for (const sessionId of Array.from(this.sessionCache.keys)) {
    const session = this.sessionCache.get(sessionId);
    if (session) {
      sessions.push([sessionId, session]);
    }
  }

  for (const [sessionId, session] of sessions) {
      // Check if session is expired based on inactivity
      if (now - session.lastActivity.getTime() > sessionTTL) {
        await this.deleteSession(sessionId);
        cleanedCount++;
        this.metrics.sessionsExpired++;
      }
    }

    if (cleanedCount > 0) {
      this.metrics.lastCleanup = new Date();
      this.logger.info('Expired sessions cleaned up', { count: cleanedCount });
      this.emit('sessionsCleaned', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Get session manager metrics
   */
  getMetrics(): SessionManagerMetrics {
    const cacheMetrics = this.sessionCache.getMemoryMetrics();

    return {
      ...this.metrics,
      memoryUsage: cacheMetrics.totalMemoryBytes,
      averageSessionSize: this.metrics.totalSessions > 0
        ? cacheMetrics.totalMemoryBytes / this.metrics.totalSessions
        : 0
    };
  }

  /**
   * Get detailed cache statistics
   */
  getCacheStats() {
    return this.sessionCache.getStats();
  }

  /**
   * Get memory metrics from cache
   */
  getMemoryMetrics(): MemoryMetrics {
    return this.sessionCache.getMemoryMetrics();
  }

  /**
   * Adjust session cache settings
   */
  updateSessionCacheSettings(options: Partial<SessionManagerOptions>): void {
    if (options.maxSessions !== undefined) {
      this.sessionCache.resize(options.maxSessions);
      this.options.maxSessions = options.maxSessions;
    }

    if (options.sessionTTL !== undefined) {
      this.sessionCache = createSessionCache({
        max: this.options.maxSessions,
        ttl: options.sessionTTL,
        maxSize: this.options.maxSize
      });
      this.options.sessionTTL = options.sessionTTL;
    }

    if (options.maxSize !== undefined) {
      this.sessionCache.setMemoryLimit(options.maxSize);
      this.options.maxSize = options.maxSize;
    }

    this.logger.info('Session cache settings updated', options);
  }

  /**
   * Force cleanup of weak reference sessions
   */
  cleanupWeakReferences(): number {
    const disposed = this.sessionCache.disposeWeakReferences();
    this.logger.info('Weak reference sessions cleaned up', { count: disposed });
    return disposed;
  }

  /**
   * Get session cache size
   */
  get cacheSize(): number {
    return this.sessionCache.size;
  }

  /**
   * Clear all sessions
   */
  async clearAllSessions(): Promise<void> {
    this.sessionCache.clear();
    this.weakReferenceSessions.clear();
    this.metrics.totalSessions = 0;
    this.metrics.activeSessions = 0;
    this.logger.info('All sessions cleared');
    this.emit('sessionsCleared');
  }

  private setupEventHandlers(): void {
    // Simple cache doesn't support events
    // This is a placeholder for any custom event handling
  }

  private startAutoCleanup(): void {
    if (this.options.enableAutoCleanup) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredSessions().catch(error => {
          this.logger.error('Auto cleanup failed', error);
        });
      }, this.options.cleanupIntervalMs);
    }
  }

  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private calculateSessionSize(session: Session): number {
    // Estimate session size in bytes
    const metadataSize = JSON.stringify(session.metadata).length;
    const capabilitiesSize = session.capabilities.join(',').length;
    const constraintsSize = session.constraints.join(',').length;
    const nameSize = session.name.length;

    return (
      // Base session object (rough estimate)
      256 +
      metadataSize +
      capabilitiesSize +
      constraintsSize +
      nameSize +
      // Date objects (rough estimate)
      32
    );
  }

  private applySessionFilters(sessions: Session[], options?: SessionFilter): Session[] {
    let filtered = sessions;

    // Apply where clause filter (simplified implementation)
    if (options?.where) {
      // This is a simplified filter implementation
      // In production, you'd want a more robust query system
      filtered = sessions.filter(session => {
        // Simple text search in session properties
        const searchTerm = options.where?.toLowerCase();
        return (
          session.name.toLowerCase().includes(searchTerm) ||
          session.workspace.toLowerCase().includes(searchTerm) ||
          session.type.toLowerCase().includes(searchTerm)
        );
      });
    }

    // Apply pagination
    if (options?.pagination) {
      const { page = 1, pageSize = 10, limit } = options.pagination;
      const effectiveLimit = limit || pageSize;
      const offset = (page - 1) * effectiveLimit;

      filtered = filtered.slice(offset, offset + effectiveLimit);
    }

    return filtered;
  }

  /**
   * Shutdown the session manager
   */
  async shutdown(): Promise<void> {
    this.stopAutoCleanup();
    this.sessionCache.clear();
    this.logger.info('Session manager shutdown complete');
    this.emit('shutdown');
  }
}

export default OptimizedSessionManager;