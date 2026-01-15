/**
 * Claude Orchestration System - Main Entry Point
 * Ultra-streamlined multi-agent orchestration with maximum efficiency
 */

// Performance-optimized orchestrators (from fastest to most feature-complete)

// Nano Orchestrator - Absolute minimal overhead (ultra-fast)
export { NanoOrchestrator as NanoOrchestrator, createNanoOrchestrator, nanoOrchestrator } from './core/nano-orchestrator.js';

// Ultimate Orchestrator - Maximum performance with zero abstraction overhead
export { UltimateOrchestrator as UnifiedOrchestrator, createUltimateOrchestrator, ultimateOrchestrator } from './core/ultimate-orchestrator.js';

// Hyper-Optimized Orchestrator - Extreme performance optimization
export { HyperOptimizedOrchestrator as HyperOrchestrator, createHyperOptimizedOrchestrator, hyperOrchestrator } from './core/hyper-optimized-orchestrator.js';

// Micro Orchestrator - Minimal overhead implementation
export { MicroOrchestrator as MicroOrchestrator, createMicroOrchestrator, microOrchestrator } from './core/micro-orchestrator.js';

// Ultra-Streamlined Orchestrator - High performance with simplicity
export { UltraStreamlinedOrchestrator as UltraStreamlinedOrchestrator, createUltraStreamlinedOrchestrator, ultraOrchestrator } from './core/ultra-streamlined-orchestrator.js';

// Pooled Orchestrator - Object pooling for memory efficiency
export { PooledOrchestrator as PooledOrchestrator, createPooledOrchestrator, pooledOrchestrator } from './core/pooled-orchestrator.js';

// Memory-Optimized Orchestrator - Pre-allocation and typed arrays
export { MemoryOptimizedOrchestrator as MemoryOptimizedOrchestrator, createMemoryOptimizedOrchestrator, memoryOptimizedOrchestrator } from './core/memory-optimized-orchestrator.js';

// Hot-Path Orchestrator - 80/20 optimization for common operations
export { HotPathOrchestrator as HotPathOrchestrator, createHotPathOrchestrator, hotPathOrchestrator } from './core/hot-path-orchestrator.js';

// Adaptive Orchestrator - Performance optimization based on usage patterns
export { AdaptiveOrchestrator as AdaptiveOrchestrator, createAdaptiveOrchestrator, adaptiveOrchestrator } from './core/adaptive-orchestrator.js';

// Specialized Orchestrators - Optimized for specific use cases
export {
  ReadOnlyOrchestrator as ReadOnlyOrchestrator, createReadOnlyOrchestrator, readOnlyOrchestrator,
  WriteHeavyOrchestrator as WriteHeavyOrchestrator, createWriteHeavyOrchestrator, writeHeavyOrchestrator,
  LowLatencyOrchestrator as LowLatencyOrchestrator, createLowLatencyOrchestrator, lowLatencyOrchestrator
} from './core/specialized-orchestrators.js';

// Streamlined Orchestrator - Production ready with full features (legacy)
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