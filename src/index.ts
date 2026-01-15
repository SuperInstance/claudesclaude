/**
 * Claude Orchestration System - Main Entry Point
 * High-performance multi-agent orchestration with optimized components
 */

export { OrchestrationSystem } from './core/registry.js';
export { MessageBus, createMessageBus } from './core/message-bus.js';
export { Director } from './core/director.js';
export { Department } from './core/department.js';
export { ContextManager } from './core/context.js';
export { CheckpointManager } from './core/checkpoint.js';
export { createRegistry } from './core/registry.js';
export { createGitManager, GitManager } from './utils/git.js';

// Core types
export type {
  Session,
  Message,
  MessageType
} from './core/types.js';