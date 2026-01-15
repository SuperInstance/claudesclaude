/**
 * Claude Orchestration System - Main Entry Point
 * Ultra-streamlined multi-agent orchestration with maximum efficiency
 */

// Primary orchestrator - Ultra-streamlined version (highest performance)
export { UltraStreamlinedOrchestrator as UnifiedOrchestrator, createUltraStreamlinedOrchestrator, ultraOrchestrator } from './core/ultra-streamlined-orchestrator.js';

// Streamlined version (maintains backwards compatibility)
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