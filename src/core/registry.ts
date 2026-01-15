/**
 * Session Registry
 * Manages active sessions, departments, and checkpoints with persistent storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  Session,
  SessionId,
  Department,
  Checkpoint,
  SessionRegistry,
  RegistryStats
} from './types';
import {
  SessionStatus,
  SessionType,
  OrchestrationError,
  SessionNotFoundError,
  ValidationError
} from './types';

export class SessionRegistryManager {
  private registry: SessionRegistry;
  private storagePath: string;
  private readonly autoSaveInterval = 30000; // 30 seconds
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(
    private storageDir: string = './.orchestration/registry',
    private autoSave: boolean = true
  ) {
    this.storagePath = storageDir;
    this.registry = this.initializeRegistry();
    this.ensureStorageDirectory();

    if (this.autoSave) {
      this.startAutoSave();
    }
  }

  private initializeRegistry(): SessionRegistry {
    return {
      sessions: new Map(),
      departments: new Map(),
      checkpoints: new Map(),
      messageQueue: [],
      stats: {
        totalSessions: 0,
        activeSessions: 0,
        totalMessages: 0,
        totalCheckpoints: 0,
        uptime: new Date()
      }
    };
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'sessions'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'departments'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'checkpoints'), { recursive: true });
    }
  }

  /**
   * Register a new session
   */
  async registerSession(session: Session): Promise<Session> {
    this.validateSession(session);

    // Check for name conflicts
    const existingSession = Array.from(this.registry.sessions.values())
      .find(s => s.name === session.name && s.type === session.type);

    if (existingSession && existingSession.status !== SessionStatus.TERMINATED) {
      throw new ValidationError(
        `Session with name '${session.name}' already exists`,
        'name'
      );
    }

    // Add to registry
    this.registry.sessions.set(session.id, session);
    this.registry.stats.totalSessions++;
    this.registry.stats.activeSessions++;

    // Persist to storage
    await this.saveSession(session);

    this.emit('sessionRegistered', session);
    return session;
  }

  /**
   * Update existing session
   */
  async updateSession(sessionId: SessionId, updates: Partial<Session>): Promise<Session> {
    const session = await this.getSession(sessionId);

    const updatedSession: Session = {
      ...session,
      ...updates,
      lastActivity: new Date() // Always update last activity
    };

    this.registry.sessions.set(sessionId, updatedSession);
    await this.saveSession(updatedSession);

    this.emit('sessionUpdated', updatedSession);
    return updatedSession;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: SessionId): Promise<Session> {
    const session = this.registry.sessions.get(sessionId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    return session;
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.registry.sessions.values());
  }

  /**
   * Get sessions by type
   */
  async getSessionsByType(type: SessionType): Promise<Session[]> {
    return Array.from(this.registry.sessions.values())
      .filter(session => session.type === type);
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<Session[]> {
    return Array.from(this.registry.sessions.values())
      .filter(session => session.status === SessionStatus.ACTIVE);
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: SessionId, reason?: string): Promise<void> {
    const session = await this.getSession(sessionId);

    const terminatedSession: Session = {
      ...session,
      status: SessionStatus.TERMINATED,
      metadata: {
        ...session.metadata,
        terminationReason: reason,
        terminatedAt: new Date()
      }
    };

    this.registry.sessions.set(sessionId, terminatedSession);

    // Update stats
    if (session.status === SessionStatus.ACTIVE) {
      this.registry.stats.activeSessions--;
    }

    await this.saveSession(terminatedSession);

    // Clean up associated departments
    const departmentIds = Array.from(this.registry.departments.keys())
      .filter(deptId => this.registry.departments.get(deptId)?.session.id === sessionId);

    for (const deptId of departmentIds) {
      await this.removeDepartment(deptId);
    }

    this.emit('sessionTerminated', terminatedSession);
  }

  /**
   * Register a department
   */
  async registerDepartment(department: Department): Promise<Department> {
    this.validateDepartment(department);

    // Check for conflicts
    const existingDepartment = this.registry.departments.get(department.id);
    if (existingDepartment) {
      throw new ValidationError(
        `Department with ID '${department.id}' already exists`,
        'id'
      );
    }

    this.registry.departments.set(department.id, department);
    await this.saveDepartment(department);

    this.emit('departmentRegistered', department);
    return department;
  }

  /**
   * Update department
   */
  async updateDepartment(departmentId: string, updates: Partial<Department>): Promise<Department> {
    const department = await this.getDepartment(departmentId);

    const updatedDepartment: Department = {
      ...department,
      ...updates,
      performance: {
        ...department.performance,
        lastActivity: new Date()
      }
    };

    this.registry.departments.set(departmentId, updatedDepartment);
    await this.saveDepartment(updatedDepartment);

    this.emit('departmentUpdated', updatedDepartment);
    return updatedDepartment;
  }

  /**
   * Get department by ID
   */
  async getDepartment(departmentId: string): Promise<Department> {
    const department = this.registry.departments.get(departmentId);

    if (!department) {
      throw new OrchestrationError(
        `Department not found: ${departmentId}`,
        'DEPARTMENT_NOT_FOUND',
        'high',
        false
      );
    }

    return department;
  }

  /**
   * Get all departments
   */
  async getAllDepartments(): Promise<Department[]> {
    return Array.from(this.registry.departments.values());
  }

  /**
   * Get departments by session
   */
  async getDepartmentsBySession(sessionId: SessionId): Promise<Department[]> {
    return Array.from(this.registry.departments.values())
      .filter(dept => dept.session.id === sessionId);
  }

  /**
   * Remove department
   */
  async removeDepartment(departmentId: string): Promise<void> {
    const department = await this.getDepartment(departmentId);

    this.registry.departments.delete(departmentId);

    // Clean up department files
    try {
      await fs.unlink(path.join(this.storagePath, 'departments', `${departmentId}.json`));
    } catch {
      // Ignore if file doesn't exist
    }

    this.emit('departmentRemoved', department);
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(checkpoint: Checkpoint): Promise<Checkpoint> {
    this.validateCheckpoint(checkpoint);

    this.registry.checkpoints.set(checkpoint.id, checkpoint);
    this.registry.stats.totalCheckpoints++;

    await this.saveCheckpoint(checkpoint);

    this.emit('checkpointCreated', checkpoint);
    return checkpoint;
  }

  /**
   * Get checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint> {
    const checkpoint = this.registry.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new OrchestrationError(
        `Checkpoint not found: ${checkpointId}`,
        'CHECKPOINT_NOT_FOUND',
        'high',
        false
      );
    }

    return checkpoint;
  }

  /**
   * Get all checkpoints
   */
  async getAllCheckpoints(): Promise<Checkpoint[]> {
    return Array.from(this.registry.checkpoints.values());
  }

  /**
   * Get checkpoints by session
   */
  async getCheckpointsBySession(sessionId: SessionId): Promise<Checkpoint[]> {
    return Array.from(this.registry.checkpoints.values())
      .filter(checkpoint => checkpoint.sessionId === sessionId);
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await this.getCheckpoint(checkpointId);

    this.registry.checkpoints.delete(checkpointId);

    // Clean up checkpoint files
    try {
      await fs.unlink(path.join(this.storagePath, 'checkpoints', `${checkpointId}.json`));
    } catch {
      // Ignore if file doesn't exist
    }

    this.emit('checkpointDeleted', checkpoint);
  }

  /**
   * Add message to queue
   */
  async enqueueMessage(message: any): Promise<void> {
    this.registry.messageQueue.push(message);
    this.registry.stats.totalMessages++;
  }

  /**
   * Get messages from queue
   */
  async dequeueMessages(count: number = 1): Promise<any[]> {
    const messages = this.registry.messageQueue.splice(0, count);
    return messages;
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    return { ...this.registry.stats };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const activeSessions = this.registry.stats.activeSessions;
    const totalSessions = this.registry.stats.totalSessions;
    const queueSize = this.registry.messageQueue.length;

    const warnings: string[] = [];

    if (activeSessions / totalSessions > 0.9) {
      warnings.push('High session utilization');
    }

    if (queueSize > 1000) {
      warnings.push('Large message queue');
    }

    if (warnings.length > 0) {
      return {
        status: 'degraded',
        details: {
          warnings,
          stats: this.registry.stats,
          queueSize
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        stats: this.registry.stats,
        queueSize
      }
    };
  }

  /**
   * Load registry from storage
   */
  async loadRegistry(): Promise<void> {
    try {
      // Load sessions
      const sessionsDir = path.join(this.storagePath, 'sessions');
      const sessionFiles = await fs.readdir(sessionsDir);

      for (const file of sessionFiles) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(sessionsDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const session: Session = JSON.parse(data);

        // Convert date strings back to Date objects
        session.createdAt = new Date(session.createdAt);
        session.lastActivity = new Date(session.lastActivity);

        this.registry.sessions.set(session.id, session);
      }

      // Load departments
      const departmentsDir = path.join(this.storagePath, 'departments');
      const departmentFiles = await fs.readdir(departmentsDir);

      for (const file of departmentFiles) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(departmentsDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const department: Department = JSON.parse(data);

        // Convert date strings back to Date objects
        department.session.createdAt = new Date(department.session.createdAt);
        department.session.lastActivity = new Date(department.session.lastActivity);
        department.performance.lastActivity = new Date(department.performance.lastActivity);

        this.registry.departments.set(department.id, department);
      }

      // Load checkpoints
      const checkpointsDir = path.join(this.storagePath, 'checkpoints');
      const checkpointFiles = await fs.readdir(checkpointsDir);

      for (const file of checkpointFiles) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(checkpointsDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const checkpoint: Checkpoint = JSON.parse(data);

        // Convert date strings back to Date objects
        checkpoint.timestamp = new Date(checkpoint.timestamp);

        this.registry.checkpoints.set(checkpoint.id, checkpoint);
      }

      // Update stats
      this.registry.stats.totalSessions = this.registry.sessions.size;
      this.registry.stats.activeSessions = Array.from(this.registry.sessions.values())
        .filter(s => s.status === SessionStatus.ACTIVE).length;
      this.registry.stats.totalCheckpoints = this.registry.checkpoints.size;

      this.emit('registryLoaded', this.registry);
    } catch (error) {
      throw new OrchestrationError(
        `Failed to load registry: ${error}`,
        'REGISTRY_LOAD_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Save session to storage
   */
  private async saveSession(session: Session): Promise<void> {
    const filePath = path.join(this.storagePath, 'sessions', `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  /**
   * Save department to storage
   */
  private async saveDepartment(department: Department): Promise<void> {
    const filePath = path.join(this.storagePath, 'departments', `${department.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(department, null, 2));
  }

  /**
   * Save checkpoint to storage
   */
  private async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const filePath = path.join(this.storagePath, 'checkpoints', `${checkpoint.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Auto-save registry state
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveRegistryState();
      } catch (error) {
        this.emit('error', new OrchestrationError(
          `Auto-save failed: ${error}`,
          'AUTO_SAVE_FAILED',
          'medium',
          true
        ));
      }
    }, this.autoSaveInterval);
  }

  /**
   * Save registry state to file
   */
  private async saveRegistryState(): Promise<void> {
    const statePath = path.join(this.storagePath, 'registry-state.json');
    const state = {
      ...this.registry,
      stats: {
        ...this.registry.stats,
        uptime: this.registry.stats.uptime.toISOString()
      }
    };

    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Validate session
   */
  private validateSession(session: Session): void {
    if (!session.id) {
      throw new ValidationError('Session ID is required', 'id');
    }

    if (!session.name) {
      throw new ValidationError('Session name is required', 'name');
    }

    if (!Object.values(SessionType).includes(session.type)) {
      throw new ValidationError(`Invalid session type: ${session.type}`, 'type');
    }

    if (!Object.values(SessionStatus).includes(session.status)) {
      throw new ValidationError(`Invalid session status: ${session.status}`, 'status');
    }
  }

  /**
   * Validate department
   */
  private validateDepartment(department: Department): void {
    if (!department.id) {
      throw new ValidationError('Department ID is required', 'id');
    }

    if (!department.name) {
      throw new ValidationError('Department name is required', 'name');
    }

    if (!department.session) {
      throw new ValidationError('Department session is required', 'session');
    }

    if (typeof department.isActive !== 'boolean') {
      throw new ValidationError('Department isActive must be boolean', 'isActive');
    }
  }

  /**
   * Validate checkpoint
   */
  private validateCheckpoint(checkpoint: Checkpoint): void {
    if (!checkpoint.id) {
      throw new ValidationError('Checkpoint ID is required', 'id');
    }

    if (!checkpoint.name) {
      throw new ValidationError('Checkpoint name is required', 'name');
    }

    if (!checkpoint.sessionId) {
      throw new ValidationError('Checkpoint sessionId is required', 'sessionId');
    }

    if (!checkpoint.timestamp) {
      throw new ValidationError('Checkpoint timestamp is required', 'timestamp');
    }
  }

  /**
   * Get EventEmitter instance for emitting events
   */
  private get emitter(): EventEmitter {
    return this as any;
  }

  /**
   * Emit event helper
   */
  private emit(eventName: string, data?: any): void {
    this.emitter.emit(eventName, data);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    await this.saveRegistryState();
    this.emit('shutdown');
  }
}

// Factory function for creating registry instance
export const createRegistry = (config?: {
  storageDir?: string;
  autoSave?: boolean;
}): SessionRegistryManager => {
  return new SessionRegistryManager(
    config?.storageDir,
    config?.autoSave
  );
};