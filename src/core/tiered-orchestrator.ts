/**
 * Tiered Orchestrator - Adaptive Performance Optimization
 * Dynamically selects optimal orchestrator based on workload characteristics
 */

import type { Session, SessionType, Message } from './types.js';
import { NanoOrchestrator } from './nano-orchestrator.js';
import { AdaptiveOrchestrator } from './adaptive-orchestrator.js';
import { JitOrchestrator } from './jit-orchestrator.js';
import { ZeroCopyOrchestrator } from './zerocopy-orchestrator.js';

// Performance tiers
enum PerformanceTier {
  NANO = 'nano',        // Ultra-low latency, minimal overhead
  JIT = 'jit',          // JIT-optimized for common patterns
  ZERO_COPY = 'zero-copy', // Memory-efficient for large datasets
  ADAPTIVE = 'adaptive'  // Balanced performance with auto-tuning
}

// Performance metrics for tier selection
interface PerformanceMetrics {
  operationsPerSecond: number;
  memoryEfficiency: number;
  latency: number;
  throughput: number;
  sessionCount: number;
  messageCount: number;
}

// Tier selection criteria
interface TierSelectionCriteria {
  lowLatency: boolean;
  highVolume: boolean;
  memoryConstrained: boolean;
  predictablePattern: boolean;
}

// Tiered orchestrator that dynamically selects the best implementation
export class TieredOrchestrator {
  private nanoOrchestrator = new NanoOrchestrator();
  private jitOrchestrator = new JitOrchestrator();
  private zeroCopyOrchestrator = new ZeroCopyOrchestrator();
  private adaptiveOrchestrator = new AdaptiveOrchestrator();

  private currentTier: PerformanceTier = PerformanceTier.NANO;
  private performanceMetrics: PerformanceMetrics = {
    operationsPerSecond: 0,
    memoryEfficiency: 1.0,
    latency: 0,
    throughput: 0,
    sessionCount: 0,
    messageCount: 0
  };

  private tierHistory: PerformanceTier[] = [];
  private operationCount = 0;
  private lastPerformanceCheck = Date.now();
  private performanceCheckInterval = 5000; // 5 seconds

  // Tier selection based on workload characteristics
  private selectTier(criteria: TierSelectionCriteria): PerformanceTier {
    const { lowLatency, highVolume, memoryConstrained, predictablePattern } = criteria;

    // Decision tree for tier selection
    if (lowLatency && !highVolume && !memoryConstrained) {
      return PerformanceTier.NANO;
    }

    if (predictablePattern && !memoryConstrained) {
      return PerformanceTier.JIT;
    }

    if (highVolume && memoryConstrained) {
      return PerformanceTier.ZERO_COPY;
    }

    // Default to adaptive for balanced performance
    return PerformanceTier.ADAPTIVE;
  }

  // Analyze current workload
  private analyzeWorkload(): TierSelectionCriteria {
    const metrics = this.performanceMetrics;
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastPerformanceCheck;

    // Calculate current performance indicators
    const opsPerSecond = this.operationCount / (timeSinceLastCheck / 1000);
    const isHighVolume = metrics.messageCount > 1000 || metrics.sessionCount > 500;
    const isMemoryConstrained = metrics.memoryEfficiency < 0.7;
    const isLowLatency = metrics.latency < 10; // ms
    const isPredictable = this.tierHistory.length > 5 &&
                         this.tierHistory.slice(-5).every(t => t === this.currentTier);

    this.operationCount = 0;
    this.lastPerformanceCheck = now;

    return {
      lowLatency: isLowLatency,
      highVolume: isHighVolume,
      memoryConstrained: isMemoryConstrained,
      predictablePattern: isPredictable
    };
  }

  // Switch to optimal orchestrator
  private switchToOptimalTier(): void {
    const criteria = this.analyzeWorkload();
    const optimalTier = this.selectTier(criteria);

    if (optimalTier !== this.currentTier) {
      console.log(`Switching from ${this.currentTier} to ${optimalTier} tier`);
      this.currentTier = optimalTier;
      this.tierHistory.push(optimalTier);
    }
  }

  // Get current orchestrator instance
  private getCurrentOrchestrator() {
    switch (this.currentTier) {
      case PerformanceTier.NANO:
        return this.nanoOrchestrator;
      case PerformanceTier.JIT:
        return this.jitOrchestrator;
      case PerformanceTier.ZERO_COPY:
        return this.zeroCopyOrchestrator;
      case PerformanceTier.ADAPTIVE:
        return this.adaptiveOrchestrator;
      default:
        return this.nanoOrchestrator;
    }
  }

  // Update performance metrics
  private updateMetrics(operationType: 'session' | 'message' | 'query', startTime: number): void {
    const endTime = Date.now();
    const duration = endTime - startTime;

    this.operationCount++;
    this.performanceMetrics.latency =
      (this.performanceMetrics.latency + duration) / 2;

    // Update session and message counts
    if (operationType === 'session') {
      this.performanceMetrics.sessionCount++;
    } else if (operationType === 'message') {
      this.performanceMetrics.messageCount++;
    }

    // Calculate throughput
    const now = Date.now();
    const timeSinceStart = (now - this.lastPerformanceCheck) / 1000;
    if (timeSinceStart > 0) {
      this.performanceMetrics.throughput = this.operationCount / timeSinceStart;
    }

    // Memory efficiency calculation (simplified)
    const totalMemory = this.performanceMetrics.sessionCount * 1000 +
                       this.performanceMetrics.messageCount * 500;
    const estimatedAvailable = 100 * 1024 * 1024; // 100MB
    this.performanceMetrics.memoryEfficiency =
      Math.min(1.0, totalMemory / estimatedAvailable);
  }

  // Tiered session creation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const startTime = Date.now();

    // Use nano orchestrator for session creation (always fast)
    const session = this.nanoOrchestrator.createSession(config);

    // Forward session to current orchestrator
    this.getCurrentOrchestrator().createSession(config);

    this.updateMetrics('session', startTime);

    // Check if we should switch tiers
    if (Date.now() - this.lastPerformanceCheck > this.performanceCheckInterval) {
      this.switchToOptimalTier();
    }

    return session;
  }

  // Tiered session retrieval
  getSession(id: string): Session | undefined {
    const startTime = Date.now();

    // Try nano orchestrator first (fast path)
    let session = this.nanoOrchestrator.getSession(id);

    if (!session) {
      // Fall back to current orchestrator
      session = this.getCurrentOrchestrator().getSession(id);
    }

    this.updateMetrics('query', startTime);

    return session;
  }

  // Tiered session update
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const startTime = Date.now();

    // Update in all orchestrators
    const nanoResult = this.nanoOrchestrator.updateSession(id, updates);
    const currentResult = this.getCurrentOrchestrator().updateSession(id, updates);

    this.updateMetrics('session', startTime);

    return currentResult || nanoResult;
  }

  // Tiered session deletion
  deleteSession(id: string): boolean {
    const startTime = Date.now();

    // Delete from all orchestrators
    const nanoResult = this.nanoOrchestrator.deleteSession(id);
    const currentResult = this.getCurrentOrchestrator().deleteSession(id);

    this.updateMetrics('session', startTime);

    return currentResult || nanoResult;
  }

  // Context management
  setContext(sessionId: string, context: any): void {
    this.getCurrentOrchestrator().setContext(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.getCurrentOrchestrator().getContext(sessionId);
  }

  // Tiered message handling
  sendMessage(sessionId: string, message: Message): boolean {
    const startTime = Date.now();

    // Send message to current orchestrator
    const result = this.getCurrentOrchestrator().sendMessage(sessionId, message);

    this.updateMetrics('message', startTime);

    return result;
  }

  // Tiered batch message processing
  processMessages(): number {
    const startTime = Date.now();

    // Process messages from current orchestrator
    const count = this.getCurrentOrchestrator().processMessages();

    this.updateMetrics('message', startTime);

    return count;
  }

  // Tiered queries
  getAllSessions(): Session[] {
    const startTime = Date.now();

    // Get sessions from current orchestrator
    const sessions = this.getCurrentOrchestrator().getAllSessions();

    this.updateMetrics('query', startTime);

    return sessions;
  }

  getSessionsByType(type: SessionType): Session[] {
    const startTime = Date.now();

    const sessions = this.getCurrentOrchestrator().getSessionsByType(type);

    this.updateMetrics('query', startTime);

    return sessions;
  }

  getSessionsByStatus(status: string): Session[] {
    const startTime = Date.now();

    const sessions = this.getCurrentOrchestrator().getSessionsByStatus(status);

    this.updateMetrics('query', startTime);

    return sessions;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const startTime = Date.now();

    const sessions = this.getCurrentOrchestrator().getWorkspaceSessions(workspace);

    this.updateMetrics('query', startTime);

    return sessions;
  }

  // Comprehensive metrics
  getMetrics() {
    const currentMetrics = this.getCurrentOrchestrator().getMetrics();

    return {
      ...currentMetrics,
      performanceTier: this.currentTier,
      operationsPerSecond: this.performanceMetrics.operationsPerSecond,
      memoryEfficiency: this.performanceMetrics.memoryEfficiency,
      averageLatency: this.performanceMetrics.latency,
      throughput: this.performanceMetrics.throughput,
      tierHistory: this.tierHistory.slice(-10), // Last 10 tier switches
      autoOptimized: true
    };
  }

  // Utility methods
  getSessionCount(): number {
    return this.getCurrentOrchestrator().getSessionCount();
  }

  clearAll(): void {
    this.nanoOrchestrator.clearAll();
    this.jitOrchestrator.clearAll();
    this.zeroCopyOrchestrator.clearAll();
    this.adaptiveOrchestrator.clearAll();
    this.getCurrentOrchestrator().clearAll();
  }

  healthCheck() {
    const metrics = this.getMetrics();
    const memoryLimit = 100 * 1024 * 1024; // 100MB

    if (metrics.memoryUsage > memoryLimit) {
      return { status: 'unhealthy', details: { memoryUsage: metrics.memoryUsage, limit: memoryLimit } };
    }

    if (metrics.activeSessions > 5000) {
      return { status: 'degraded', details: { activeSessions: metrics.activeSessions } };
    }

    return { status: 'healthy', details: metrics };
  }

  exportSessions(): any[] {
    return this.getCurrentOrchestrator().exportSessions();
  }

  importSessions(sessions: any[]): void {
    sessions.forEach(s => {
      this.createSession({
        type: s.type,
        name: s.name,
        workspace: s.workspace,
        config: s.config
      });
    });
  }

  // Event methods
  onSessionCreated(callback: (session: Session) => void) {
    this.getCurrentOrchestrator().onSessionCreated(callback);
  }
  onSessionUpdated(callback: (session: Session) => void) {
    this.getCurrentOrchestrator().onSessionUpdated(callback);
  }
  onSessionDeleted(callback: (session: Session) => void) {
    this.getCurrentOrchestrator().onSessionDeleted(callback);
  }
  onMessage(callback: (message: Message) => void) {
    this.getCurrentOrchestrator().onMessage(callback);
  }

  // Manual tier control
  getCurrentTier(): PerformanceTier {
    return this.currentTier;
  }

  setTier(tier: PerformanceTier): void {
    this.currentTier = tier;
    this.tierHistory.push(tier);
    console.log(`Manually set tier to ${tier}`);
  }

  getAvailableTiers(): PerformanceTier[] {
    return Object.values(PerformanceTier);
  }

  // Performance analysis
  analyzePerformance(): {
    currentTier: PerformanceTier;
    recommendations: string[];
    metrics: PerformanceMetrics;
  } {
    const criteria = this.analyzeWorkload();
    const optimalTier = this.selectTier(criteria);

    const recommendations: string[] = [];

    if (optimalTier !== this.currentTier) {
      recommendations.push(`Consider switching to ${optimalTier} tier for better performance`);
    }

    if (this.performanceMetrics.memoryEfficiency < 0.5) {
      recommendations.push('Memory usage is high, consider zero-copy optimization');
    }

    if (this.performanceMetrics.latency > 100) {
      recommendations.push('High latency detected, consider nano-tier for faster operations');
    }

    return {
      currentTier: this.currentTier,
      recommendations,
      metrics: this.performanceMetrics
    };
  }
}

// Factory function
export function createTieredOrchestrator(): TieredOrchestrator {
  return new TieredOrchestrator();
}

// Default instance
export const tieredOrchestrator = createTieredOrchestrator();