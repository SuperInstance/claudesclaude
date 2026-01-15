/**
 * Mechanical Operations Package - Complete Export
 *
 * This package exports all mechanical operations that can work independently
 * of AI model processing, designed for maximum performance and efficiency.
 */

// Core mechanical operations
export * from './core/mechanical-orchestrator.js';

// Individual utilities for standalone use
export * from './utils/uuid-generator.js';
export * from './utils/timestamp-operations.js';
export * from './utils/workspace-manager.js';
export * from './utils/serialization-utils.js';
export * from './utils/object-pool.js';
export * from './utils/connection-pool.js';

// Import types
import type { Session, SessionType, Message } from './core/types.js';

// Re-export types for convenience
export type { Session, SessionType, Message } from './core/types.js';

/**
 * Quick start guide for mechanical operations:
 *
 * 1. **Basic Mechanical Orchestrator Usage:**
 * ```typescript
 * import { createMechanicalOrchestrator } from './mechanical-operations.js';
 *
 * const orchestrator = createMechanicalOrchestrator({
 *   workspacePath: './workspace',
 *   enableObjectPooling: true,
 *   enableSerialization: true,
 *   enableWorkspaceManagement: true
 * });
 *
 * // Create a session
 * const session = await orchestrator.createSession({
 *   type: 'ai-assistant',
 *   name: 'My Assistant',
 *   workspace: 'project-a',
 *   persist: true
 * });
 *
 * // Set context with automatic serialization
 * await orchestrator.setContext(session.id, {
 *   data: 'complex object structure',
 *   metadata: { timestamp: Date.now() }
 * });
 *
 * // Get metrics
 * const metrics = orchestrator.getMetrics();
 * console.log('Performance:', metrics);
 * ```
 *
 * 2. **Standalone UUID Generation:**
 * ```typescript
 * import { uuidGenerator, generateUUID, generateFastUUID } from './mechanical-operations.js';
 *
 * // Fast UUID generation for high-throughput scenarios
 * const fastId = generateFastUUID();
 *
 * // Cryptographically secure UUID generation
 * const secureId = generateUUID();
 *
 * // Configurable strategy
 * uuidGenerator.setUseFastMode(true); // Switch to fast mode
 * ```
 *
 * 3. **Standalone Workspace Management:**
 * ```typescript
 * import { createWorkspaceManager } from './mechanical-operations.js';
 *
 * const workspace = createWorkspaceManager('./my-workspace');
 *
 * // Write file with compression
 * await workspace.writeFile('data.json', { key: 'value' });
 *
 * // Read with caching
 * const data = await workspace.readFile('data.json', { cache: true });
 *
 * // Batch operations
 * await workspace.batchOperations([
 *   { operation: 'write', path: 'file1.txt', content: 'content1' },
 *   { operation: 'write', path: 'file2.txt', content: 'content2' }
 * ]);
 *
 * // Get workspace info
 * const info = await workspace.getWorkspaceInfo();
 * ```
 *
 * 4. **Standalone Serialization:**
 * ```typescript
 * import { serialize, deserialize, calculateCompressionRatio } from './mechanical-operations.js';
 *
 * const data = { complex: 'object', with: { nested: 'structures' } };
 *
 * // Serialize with compression
 * const serialized = await serialize(data, {
 *   format: 'json',
 *   compress: true,
 *   cache: true
 * });
 *
 * // Deserialize
 * const deserialized = await deserialize(serialized.data, {
 *   format: 'json',
 *   compress: true
 * });
 *
 * // Check compression efficiency
 * const ratio = calculateCompressionRatio(serialized.originalSize, serialized.finalSize);
 * ```
 *
 * 5. **Standalone Object Pooling:**
 * ```typescript
 * import { createPool, SessionPool } from './mechanical-operations.js';
 *
 * // Create a custom pool
 * const stringPool = createPool({
 *   initialSize: 10,
 *   maxPoolSize: 100,
 *   minPoolSize: 5,
 *   createObject: () => '',
 *   resetObject: (str) => str.trim()
 * });
 *
 * // Use the pool
 * const str1 = stringPool.acquire();
 * const str2 = stringPool.acquire();
 *
 * // Return to pool
 * stringPool.release(str1);
 * stringPool.release(str2);
 *
 * // Pre-configured session pool
 * const sessionPool = new SessionPool();
 * const session = sessionPool.acquireSession('ai-assistant', 'My Session', 'workspace');
 * sessionPool.release(session);
 * ```
 *
 * 6. **Standalone Connection Pooling:**
 * ```typescript
 * import { createTCPConnectionPool, connectionPoolManager } from './mechanical-operations.js';
 *
 * // Create a connection pool
 * const pool = createTCPConnectionPool({
 *   host: 'localhost',
 *   port: 8080
 * }, {
 *   maxConnections: 10,
 *   minConnections: 2,
 *   acquireTimeout: 5000
 * });
 *
 * // Acquire connection
 * const connection = await pool.acquire();
 *
 * // Execute command
 * const result = await connection.execute('GET key');
 *
 * // Release connection
 * await pool.release(connection);
 *
 * // Global connection pool manager
 * connectionPoolManager.createPool('db', {
 *   host: 'localhost',
 *   port: 5432
 * });
 * ```
 *
 * 7. **Standalone Timestamp Operations:**
 * ```typescript
 * import { TimestampOperations, format, diff, createRange } from './mechanical-operations.js';
 *
 * // Format timestamp with caching
 * const formatted = format(Date.now(), {
 *   includeTimezone: true,
 *   includeMilliseconds: true
 * });
 *
 * // Calculate time differences
 * const timeDiff = diff(Date.now(), Date.now() - 3600000); // 1 hour ago
 * console.log(`${timeDiff.hours} hours, ${timeDiff.minutes} minutes`);
 *
 * // Create time ranges
 * const range = createRange(Date.now(), 3600000); // 1 hour duration
 * console.log(range);
 * ```
 *
 * Performance Best Practices:
 * 1. Use object pooling for frequently created objects
 * 2. Enable compression for large data payloads
 * 3. Use caching for file operations
 * 4. Choose appropriate UUID generation strategies
 * 5. Monitor metrics to identify bottlenecks
 * 6. Warm up pools before heavy usage
 * 7. Configure timeouts appropriately
 * 8. Use batch operations for bulk file operations
 * 9. Implement proper error handling
 * 10. Regularly clean up workspace resources
 */

// Default exports for easy importing
export { createMechanicalOrchestrator } from './core/mechanical-orchestrator.js';
export { uuidGenerator } from './utils/uuid-generator.js';
export { TimestampOperations } from './utils/timestamp-operations.js';
export { WorkspaceManager } from './utils/workspace-manager.js';
export { SerializationUtils } from './utils/serialization-utils.js';
export { ObjectPool } from './utils/object-pool.js';
export { ConnectionPoolManager } from './utils/connection-pool.js';

// Convenience functions
export {
  generateUUID,
  generateFastUUID,
  generateSecureUUID
} from './utils/uuid-generator.js';

export {
  now,
  format,
  parse,
  diff,
  add,
  isInRange,
  createRange,
  round,
  floor,
  ceil,
  startOfDay,
  endOfDay,
  startOfWeek
} from './utils/timestamp-operations.js';

export {
  serialize,
  deserialize,
  batchSerialize,
  batchDeserialize,
  calculateCompressionRatio
} from './utils/serialization-utils.js';

export {
  createPool,
  SessionPool,
  HighFrequencyPool,
  SimplePool,
  benchmarkPool
} from './utils/object-pool.js';

export {
  createTCPConnectionPool,
  createTLSConnectionPool,
  connectionPoolManager
} from './utils/connection-pool.js';