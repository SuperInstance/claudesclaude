/**
 * Claude Orchestration System - Main Entry Point
 * High-performance multi-agent orchestration with optimized components
 */

export { OrchestrationSystem } from './core/registry.js';
export { MessageBus, createMessageBus } from './core/message-bus.js';
export { Director, type DirectorConfig } from './core/director.js';
export { Department } from './core/department.js';
export { ContextManager } from './core/context.js';
export { CheckpointManager, type CheckpointConfig } from './core/checkpoint.js';
export { createRegistry } from './core/registry.js';
export { createGitManager, GitManager } from './utils/git.js';

// Core types
export type {
  Session,
  SessionId,
  Message,
  MessageType,
  Task,
  DepartmentConfig,
  CheckpointType
} from './core/types.js';