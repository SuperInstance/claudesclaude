/**
 * Claude Orchestration System SDK
 *
 * This is the main entry point for the orchestration SDK.
 * It exports all the core components and utilities.
 */

// Core types and interfaces
export * from './types';

// Core API clients
export * from './clients/orchestration-client';
export * from './clients/message-bus-client';
export * from './clients/database-client';
export * from './clients/worker-client';
export * from './clients/session-client';
export * from './clients/checkpoint-client';

// Utilities
export * from './utils/logger';
export * from './utils/error-handler';
export * from './utils/config-loader';
export * from './utils/validation';

// Default export
import { OrchestrationClient } from './clients/orchestration-client';

export default OrchestrationClient;

// Version
export const SDK_VERSION = '1.0.0';