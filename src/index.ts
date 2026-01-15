/**
 * Claude Orchestration System - Main Entry Point
 * Ultra-streamlined multi-agent orchestration with maximum efficiency
 */

// Performance-optimized orchestrators (from fastest to most feature-complete)

// Ultimate Orchestrator - Maximum performance with zero abstraction overhead
export { UltimateOrchestrator as UnifiedOrchestrator, createUltimateOrchestrator, ultimateOrchestrator } from './core/ultimate-orchestrator.js';

// Hyper-Optimized Orchestrator - Extreme performance optimization
export { HyperOptimizedOrchestrator as HyperOrchestrator, createHyperOptimizedOrchestrator, hyperOrchestrator } from './core/hyper-optimized-orchestrator.js';

// Micro Orchestrator - Minimal overhead implementation
export { MicroOrchestrator as MicroOrchestrator, createMicroOrchestrator, microOrchestrator } from './core/micro-orchestrator.js';

// Ultra-Streamlined Orchestrator - High performance with simplicity
export { UltraStreamlinedOrchestrator as UltraStreamlinedOrchestrator, createUltraStreamlinedOrchestrator, ultraOrchestrator } from './core/ultra-streamlined-orchestrator.js';

// Streamlined Orchestrator - Production ready with full features
export { StreamlinedOrchestrator as StreamlinedOrchestrator, createStreamlinedOrchestrator, orchestrator } from './core/streamlined-orchestrator.js';

// Core types
export type {
  Session,
  SessionType,
  Message,
  MessageType,
  SessionStatus
} from './core/types.js';

// Simplified utilities
export {
  SimpleUUID,
  SimpleTimestamp,
  uuidGenerator,
  timestampOps,
  generateUUID,
  generateFastUUID,
  generateSecureUUID,
  now,
  formatTime,
  timeDiff,
  createTimeRange
} from './utils/simple-utils.js';

export { SimpleLRUCache } from './utils/simple-lru-cache.js';