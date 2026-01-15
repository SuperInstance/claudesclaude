/**
 * High-Performance Event Batching System
 *
 * Provides efficient event batching for high-frequency events with
 * configurable batching strategies and timing controls.
 */

import { EventEmitter } from 'events';

export interface BatchedEvent<T = any> {
  event: string;
  data: T;
  timestamp: number;
  priority?: number;
  source?: string;
}

export interface BatchConfig {
  maxSize: number; // Maximum number of events to batch
  maxWaitMs: number; // Maximum time to wait before flushing
  maxMemoryBytes?: number; // Maximum memory usage for batched events
  enablePriority: boolean; // Whether to support priority-based batching
  enableDeduplication: boolean; // Whether to deduplicate events
  dedupKey?: (event: BatchedEvent) => string; // Function to generate dedup keys
}

export interface BatchStats {
  batchSize: number;
  waitTime: number;
  memoryUsage: number;
  duplicatesRemoved: number;
  batchesFlushed: number;
  totalEvents: number;
}

export class EventBatcher extends EventEmitter {
  private config: Required<BatchConfig>;
  private eventQueue: BatchedEvent[] = [];
  private pendingTimers: NodeJS.Timeout[] = [];
  private stats: BatchStats = {
    batchSize: 0,
    waitTime: 0,
    memoryUsage: 0,
    duplicatesRemoved: 0,
    batchesFlushed: 0,
    totalEvents: 0
  };
  private totalMemoryUsage = 0;
  private eventCounts = new Map<string, number>();
  private lastFlushTime = Date.now();

  constructor(config: Partial<BatchConfig> = {}) {
    super();

    this.config = {
      maxSize: config.maxSize ?? 100,
      maxWaitMs: config.maxWaitMs ?? 16, // ~60fps
      maxMemoryBytes: config.maxMemoryBytes ?? 10 * 1024 * 1024, // 10MB default
      enablePriority: config.enablePriority ?? true,
      enableDeduplication: config.enableDeduplication ?? false,
      dedupKey: config.dedupKey ?? ((event: BatchedEvent) => `${event.event}-${JSON.stringify(event.data)}`)
    };

    this.setupAutoFlush();
  }

  /**
   * Add an event to the batch
   */
  emit<T>(event: string, data: T, options?: {
    priority?: number;
    source?: string;
    immediate?: boolean;
  }): boolean {
    // If immediate flush requested, bypass batching
    if (options?.immediate) {
      this.flush([{
        event,
        data,
        timestamp: Date.now(),
        priority: options.priority,
        source: options.source
      }]);
      return true;
    }

    const batchedEvent: BatchedEvent<T> = {
      event,
      data,
      timestamp: Date.now(),
      priority: options?.priority ?? 0,
      source: options?.source
    };

    // Check memory limits
    const eventSize = this.calculateEventSize(batchedEvent);
    if (this.totalMemoryUsage + eventSize > this.config.maxMemoryBytes) {
      // If adding this event would exceed memory limit, flush first
      this.flush();
    }

    // Apply deduplication if enabled
    if (this.config.enableDeduplication) {
      const dedupKey = this.config.dedupKey(batchedEvent);
      const existingIndex = this.eventQueue.findIndex(e => this.config.dedupKey(e) === dedupKey);

      if (existingIndex >= 0) {
        // Replace existing event with new one (update data)
        this.eventQueue[existingIndex] = batchedEvent;
        this.stats.duplicatesRemoved++;
        this.totalMemoryUsage = this.calculateTotalMemoryUsage();
        return true;
      }
    }

    // Insert with priority if enabled
    if (this.config.enablePriority) {
      const insertIndex = this.findInsertIndex(batchedEvent);
      this.eventQueue.splice(insertIndex, 0, batchedEvent);
    } else {
      this.eventQueue.push(batchedEvent);
    }

    // Update memory usage
    this.totalMemoryUsage += eventSize;

    // Update event counts
    this.eventCounts.set(event, (this.eventCounts.get(event) || 0) + 1);
    this.stats.totalEvents++;

    // Check if we need to flush
    this.checkFlushConditions();

    return true;
  }

  /**
   * Flush all pending events
   */
  flush(events?: BatchedEvent[]): void {
    const eventsToFlush = events || this.eventQueue;
    const batchCount = eventsToFlush.length;

    if (batchCount === 0) {
      return;
    }

    // Calculate wait time
    const now = Date.now();
    const waitTime = now - this.lastFlushTime;
    this.lastFlushTime = now;

    // Update stats
    this.stats.batchesFlushed++;
    this.stats.batchSize = batchCount;
    this.stats.waitTime = waitTime;
    this.stats.memoryUsage = this.totalMemoryUsage;

    // Group events by type for more efficient processing
    const eventsByType = new Map<string, BatchedEvent[]>();

    for (const event of eventsToFlush) {
      if (!eventsByType.has(event.event)) {
        eventsByType.set(event.event, []);
      }
      eventsByType.get(event.event)!.push(event);
    }

    // Emit batched events
    for (const [eventType, batch] of eventsByType) {
      this.emit('batch', {
        eventType,
        events: batch,
        count: batch.length,
        timestamp: now,
        averageWaitTime: batch.reduce((sum, e) => sum + (now - e.timestamp), 0) / batch.length
      });

      // Also emit individual events if needed
      this.emit('individual', batch);
    }

    // Clear flushed events and reset memory
    if (!events) {
      this.eventQueue = [];
    } else {
      // Only remove the events that were flushed
      const flushedEvents = new Set(events);
      this.eventQueue = this.eventQueue.filter(e => !flushedEvents.has(e));
    }

    this.totalMemoryUsage = this.calculateTotalMemoryUsage();
  }

  /**
   * Force immediate flush
   */
  flushImmediately(): void {
    // Clear any pending timers
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers = [];

    // Flush all pending events
    this.flush();
  }

  /**
   * Get current batch status
   */
  getStatus(): {
    queueSize: number;
    memoryUsage: number;
    memoryPercentage: number;
    avgWaitTime: number;
    eventsByType: Record<string, number>;
  } {
    const avgWaitTime = this.stats.waitTime > 0 ? this.stats.waitTime : 16;
    const memoryPercentage = (this.totalMemoryUsage / this.config.maxMemoryBytes) * 100;

    const eventsByType: Record<string, number> = {};
    for (const [event, count] of this.eventCounts) {
      eventsByType[event] = count;
    }

    return {
      queueSize: this.eventQueue.length,
      memoryUsage: this.totalMemoryUsage,
      memoryPercentage,
      avgWaitTime,
      eventsByType
    };
  }

  /**
   * Get performance stats
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = {
      batchSize: 0,
      waitTime: 0,
      memoryUsage: 0,
      duplicatesRemoved: 0,
      batchesFlushed: 0,
      totalEvents: 0
    };
    this.eventCounts.clear();
  }

  /**
   * Pause batching
   */
  pause(): void {
    this.flushImmediately();
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers = [];
  }

  /**
   * Resume batching
   */
  resume(): void {
    this.setupAutoFlush();
  }

  /**
   * Change batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    const oldMaxMemory = this.config.maxMemoryBytes;
    this.config = { ...this.config, ...newConfig };

    // If memory limit decreased, check if we need to flush
    if (oldMaxMemory && this.config.maxMemoryBytes && oldMaxMemory > this.config.maxMemoryBytes) {
      if (this.totalMemoryUsage > this.config.maxMemoryBytes) {
        this.flushImmediately();
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.flushImmediately();
    this.removeAllListeners();
    this.resetStats();
  }

  private setupAutoFlush(): void {
    // Set up periodic flush timer
    const timer = setTimeout(() => {
      this.flush();
    }, this.config.maxWaitMs);

    this.pendingTimers.push(timer);
  }

  private checkFlushConditions(): void {
    // Check if batch is full
    if (this.eventQueue.length >= this.config.maxSize) {
      this.flushImmediately();
      return;
    }

    // Check if memory limit would be exceeded by next event
    const nextEventSize = this.eventQueue.length > 0
      ? this.calculateEventSize(this.eventQueue[0])
      : 0;

    if (this.totalMemoryUsage + nextEventSize > this.config.maxMemoryBytes) {
      this.flushImmediately();
      return;
    }

    // Reset timer for next flush
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers = [];

    this.setupAutoFlush();
  }

  private findInsertIndex(event: BatchedEvent): number {
    let low = 0;
    let high = this.eventQueue.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midEvent = this.eventQueue[mid];

      if (midEvent.priority! < event.priority!) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return low;
  }

  private calculateEventSize(event: BatchedEvent): number {
    // Estimate event size in bytes
    let dataStr = '';
    try {
      dataStr = JSON.stringify(event.data);
    } catch (e) {
      // Handle circular references or non-serializable objects
      dataStr = JSON.stringify({ __error: 'Non-serializable object' });
    }
    return (
      event.event.length * 2 + // event name
      dataStr.length * 2 + // data
      16 + // timestamp, priority, source overhead
      (event.source?.length || 0) * 2
    );
  }

  private calculateTotalMemoryUsage(): number {
    return this.eventQueue.reduce((total, event) => total + this.calculateEventSize(event), 0);
  }
}

// Factory function for common use cases
export function createEventBatcher(config?: Partial<BatchConfig>): EventBatcher {
  return new EventBatcher(config);
}

// Specialized batchers for different use cases
export class SessionEventBatcher extends EventBatcher {
  constructor() {
    super({
      maxSize: 50,
      maxWaitMs: 32, // Lower latency for session events
      enablePriority: true,
      enableDeduplication: false
    });
  }
}

export class MetricEventBatcher extends EventBatcher {
  constructor() {
    super({
      maxSize: 200,
      maxWaitMs: 1000, // Slower batch for metrics
      enablePriority: false,
      enableDeduplication: true,
      dedupKey: (event: BatchedEvent) => `${event.event}-${event.timestamp}`
    });
  }
}

// High-frequency event batcher for real-time systems
export class HighFrequencyEventBatcher extends EventBatcher {
  constructor() {
    super({
      maxSize: 1000,
      maxWaitMs: 4, // 250fps
      maxMemoryBytes: 50 * 1024 * 1024, // 50MB
      enablePriority: true,
      enableDeduplication: true
    });
  }
}