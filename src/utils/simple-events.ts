/**
 * Simplified Event System - Consolidated from EventManager and EventBatcher
 * Provides efficient event handling with built-in batching and minimal overhead
 */

// Core event interface
export interface BatchedEvent<T = any> {
  event: string;
  data: T;
  timestamp: number;
  priority?: number;
  source?: string;
}

// Simple event batching configuration
export interface BatchConfig {
  maxSize: number;
  maxWaitMs: number;
  enablePriority: boolean;
  enableDeduplication: boolean;
  dedupKey?: (event: BatchedEvent) => string;
}

// Metrics interface
export interface EventMetrics {
  totalEvents: number;
  totalProcessed: number;
  averageProcessingTime: number;
  memoryUsage: number;
}

// Simplified event system with batching
export class SimpleEventManager {
  private events = new Map<string, Set<Function>>();
  private batchQueue: BatchedEvent[] = [];
  private batchConfig: BatchConfig;
  private metrics: EventMetrics;
  private batchTimeout?: NodeJS.Timeout;
  private processingTimes: number[] = [];
  private lastFlush = 0;

  constructor(config: BatchConfig = {
    maxSize: 100,
    maxWaitMs: 16,
    enablePriority: false,
    enableDeduplication: false
  }) {
    this.batchConfig = config;
    this.metrics = this.initializeMetrics();
  }

  // Initialize metrics
  private initializeMetrics(): EventMetrics {
    return {
      totalEvents: 0,
      totalProcessed: 0,
      averageProcessingTime: 0,
      memoryUsage: 0
    };
  }

  // Emit event with batching
  emit<T>(event: string, data: T, priority?: number, source?: string): void {
    const now = Date.now();
    this.metrics.totalEvents++;

    // Create event
    const eventData: BatchedEvent<T> = { event, data, timestamp: now, priority, source };

    // Apply deduplication if enabled
    if (this.batchConfig.enableDeduplication && this.batchConfig.dedupKey) {
      const dedupKey = this.batchConfig.dedupKey(eventData);
      const existingIndex = this.batchQueue.findIndex(e => this.batchConfig.dedupKey?.(e) === dedupKey);
      if (existingIndex !== -1) {
        this.batchQueue[existingIndex] = eventData;
        return;
      }
    }

    // Add to batch
    this.batchQueue.push(eventData);

    // Sort by priority if enabled
    if (this.batchConfig.enablePriority) {
      this.batchQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    // Check if we should flush
    const shouldFlush = this.batchQueue.length >= this.batchConfig.maxSize ||
      (now - this.lastFlush) >= this.batchConfig.maxWaitMs;

    if (shouldFlush) {
      this.flush();
    } else if (!this.batchTimeout) {
      // Schedule flush
      this.batchTimeout = setTimeout(() => this.flush(), this.batchConfig.maxWaitMs);
    }
  }

  // Process all batched events
  private flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    const events = this.batchQueue;
    this.batchQueue = [];
    this.lastFlush = Date.now();

    // Process each event
    events.forEach(event => {
      const startTime = performance.now();

      // Call all listeners for this event
      const listeners = this.events.get(event.event);
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(event.data);
          } catch (error) {
            // Log error but continue processing
            console.warn('Event listener error:', error);
          }
        });
      }

      // Update metrics
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift();
      }

      this.metrics.totalProcessed++;
    });

    // Update metrics
    this.updateMetrics();
  }

  // Add event listener
  on<T>(event: string, listener: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
  }

  // Remove event listener
  off<T>(event: string, listener: (data: T) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
  }

  // Get current metrics
  getMetrics(): EventMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  // Update metrics
  private updateMetrics(): void {
    if (this.processingTimes.length > 0) {
      this.metrics.averageProcessingTime =
        this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    }

    // Estimate memory usage
    this.metrics.memoryUsage =
      this.batchQueue.length * 100 + // Rough estimate per event
      this.processingTimes.length * 8;
  }

  // Force immediate flush
  forceFlush(): void {
    this.flush();
  }

  // Clear all events and listeners
  clear(): void {
    this.batchQueue = [];
    this.events.clear();
    this.processingTimes = [];
    this.updateMetrics();
  }
}

// Singleton instance for convenience
export const eventManager = new SimpleEventManager({
  maxSize: 50,
  maxWaitMs: 16,
  enablePriority: false,
  enableDeduplication: false
});