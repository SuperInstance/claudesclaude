/**
 * Claude Orchestration System - Main Entry Point
 * Unified multi-agent orchestration with minimal moving parts
 */

// Core orchestrator
export { UnifiedOrchestrator, createUnifiedOrchestrator } from './core/unified.js';
export { createGitManager, GitManager } from './utils/git.js';

// Mechanical operations package
export * from './mechanical-operations.js';

// Core types
export type {
  Session,
  Message,
  MessageType,
  SessionType,
  SessionStatus
} from './core/types.js';

// Optimized orchestrator with mechanical operations
export {
  MechanicalOrchestrator,
  createMechanicalOrchestrator,
  DEFAULT_MECHANICAL_CONFIG
} from './core/mechanical-orchestrator.js';