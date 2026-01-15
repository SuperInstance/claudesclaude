/**
 * Claude Orchestration System - Main Entry Point
 * Unified multi-agent orchestration with minimal moving parts
 */

export { UnifiedOrchestrator, createUnifiedOrchestrator } from './core/unified.js';
export { createGitManager, GitManager } from './utils/git.js';

// Core types
export type {
  Session,
  Message,
  MessageType,
  SessionType,
  SessionStatus
} from './core/types.js';