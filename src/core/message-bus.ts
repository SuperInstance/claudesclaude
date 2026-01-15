/**
 * Message Bus Implementation
 * File-based communication system for multi-session orchestration
 * Provides reliable message delivery with persistence and retry logic
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import type {
  Message,
  MessageSubscriber,
  MessageFilter,
  MessageBusStats
} from './types';
import {
  MessageType,
  MessagePriority,
  OrchestrationError,
  MessageTimeoutError,
  ValidationError
} from './types';

export class MessageBus extends EventEmitter {
  private queueDir: string;
  private processedDir: string;
  private errorDir: string;
  private subscribers: Map<string, MessageSubscriber> = new Map();
  private stats: MessageBusStats = {
    messagesPublished: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
    averageLatency: 0,
    subscribers: 0,
    queueSize: 0
  };
  private processing = false;
  private gcInterval: NodeJS.Timeout | null = null;
  private readonly maxRetries = 3;
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private queuePath: string = './.orchestration/queue',
    private maxQueueSize: number = 10000,
    private gcIntervalMs: number = 60000 // 1 minute
  ) {
    super();
    this.queueDir = path.join(queuePath, 'pending');
    this.processedDir = path.join(queuePath, 'processed');
    this.errorDir = path.join(queuePath, 'error');
    this.initializeDirectories();
    this.startGarbageCollection();
  }

  private async initializeDirectories(): Promise<void> {
    const dirs = [this.queueDir, this.processedDir, this.errorDir];
    await Promise.all(dirs.map(dir => fs.mkdir(dir, { recursive: true })));
  }

  /**
   * Publish a message to the message bus
   */
  async publish(message: Message): Promise<void> {
    this.validateMessage(message);

    const messageFile = path.join(this.queueDir, `${message.id}.json`);
    const messageData = {
      ...message,
      timestamp: message.timestamp.toISOString(),
      receivedAt: new Date().toISOString()
    };

    try {
      await fs.writeFile(messageFile, JSON.stringify(messageData, null, 2));
      this.stats.messagesPublished++;
      this.stats.queueSize++;

      this.emit('messagePublished', message);

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    } catch (error) {
      this.stats.messagesFailed++;
      throw new OrchestrationError(
        `Failed to publish message: ${error}`,
        'MESSAGE_PUBLISH_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Subscribe to messages with optional filtering
   */
  subscribe(
    subscriber: (message: Message) => Promise<void>,
    filter?: MessageFilter
 ): () => void {
    const subscriberId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const wrappedSubscriber: MessageSubscriber = {
      id: subscriberId,
      callback: subscriber,
      filter
    };

    this.subscribers.set(subscriberId, wrappedSubscriber);
    this.stats.subscribers = this.subscribers.size;

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriberId);
      this.stats.subscribers = this.subscribers.size;
    };
  }

  /**
   * Send a request and wait for response
   */
  async request(request: Message, timeout: number = 30000): Promise<Message> {
    const requestId = `req-${request.id}`;
    const responsePromise = new Promise<Message>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(responseEvent, handler);
        reject(new MessageTimeoutError(request.id, timeout));
      }, timeout);

      const handler = (response: Message) => {
        if (response.metadata.correlationId === requestId) {
          clearTimeout(timer);
          this.off(responseEvent, handler);
          resolve(response);
        }
      };

      const responseEvent = `response:${requestId}`;
      this.on(responseEvent, handler);
    });

    // Add correlation ID for response matching
    request.metadata.correlationId = requestId;
    request.requiresResponse = true;

    await this.publish(request);
    return responsePromise;
  }

  /**
   * Acknowledge a message has been processed
   */
  async acknowledge(messageId: string): Promise<void> {
    const sourceFile = path.join(this.queueDir, `${messageId}.json`);
    const destFile = path.join(this.processedDir, `${messageId}.json`);

    try {
      await fs.rename(sourceFile, destFile);
      this.stats.queueSize--;
      this.stats.messagesDelivered++;
      await this.updateLatencyStats(messageId);
    } catch (error) {
      throw new OrchestrationError(
        `Failed to acknowledge message: ${error}`,
        'MESSAGE_ACK_FAILED',
        'medium',
        true
      );
    }
  }

  /**
   * Reject a message (move to error queue)
   */
  async reject(messageId: string, reason: string): Promise<void> {
    const sourceFile = path.join(this.queueDir, `${messageId}.json`);
    const destFile = path.join(this.errorDir, `${messageId}.json`);

    try {
      const messageData = await fs.readFile(sourceFile, 'utf8');
      const message = JSON.parse(messageData);

      // Add rejection metadata
      message.metadata.rejectionReason = reason;
      message.metadata.rejectedAt = new Date().toISOString();

      await fs.writeFile(destFile, JSON.stringify(message, null, 2));
      await fs.unlink(sourceFile);

      this.stats.queueSize--;
      this.stats.messagesFailed++;
    } catch (error) {
      throw new OrchestrationError(
        `Failed to reject message: ${error}`,
        'MESSAGE_REJECT_FAILED',
        'medium',
        true
      );
    }
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    try {
      while (this.stats.queueSize > 0) {
        const messageFiles = await fs.readdir(this.queueDir);

        if (messageFiles.length === 0) break;

        for (const file of messageFiles) {
          if (!file.endsWith('.json')) continue;

          const messageId = file.replace('.json', '');
          await this.processMessage(messageId);
        }
      }
    } catch (error) {
      this.emit('error', new OrchestrationError(
        `Queue processing error: ${error}`,
        'QUEUE_PROCESS_ERROR',
        'high',
        true
      ));
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(messageId: string): Promise<void> {
    const messageFile = path.join(this.queueDir, `${messageId}.json`);

    try {
      const messageData = await fs.readFile(messageFile, 'utf8');
      const parsedData = JSON.parse(messageData);
      const message: Message = {
        ...parsedData,
        timestamp: new Date(parsedData.timestamp)
      };

      // Filter subscribers
      const matchingSubscribers = this.getMatchingSubscribers(message);

      if (matchingSubscribers.length === 0) {
        await this.acknowledge(messageId);
        return;
      }

      // Process message with each subscriber
      const processingPromises = matchingSubscribers.map(async (subscriber) => {
        try {
          await subscriber.callback(message);
          await this.acknowledge(messageId);
        } catch (error) {
          await this.handleSubscriberError(messageId, error);
        }
      });

      await Promise.all(processingPromises);
    } catch (error) {
      await this.reject(messageId, `Processing error: ${error}`);
    }
  }

  /**
   * Get subscribers that match the message filter
   */
  private getMatchingSubscribers(message: Message): MessageSubscriber[] {
    const matching: MessageSubscriber[] = [];

    for (const subscriber of this.subscribers.values()) {
      if (!subscriber.filter) {
        matching.push(subscriber);
        continue;
      }

      const filter = subscriber.filter;
      let matches = true;

      // Check type filter
      if (filter.types && !filter.types.includes(message.type)) {
        matches = false;
      }

      // Check priority filter
      if (filter.priorities && !filter.priorities.includes(message.priority)) {
        matches = false;
      }

      // Check sender filter
      if (filter.senders && !filter.senders.includes(message.sender)) {
        matches = false;
      }

      // Check receiver filter
      if (filter.receivers && message.receiver && !filter.receivers.includes(message.receiver)) {
        matches = false;
      }

      // Check tags filter
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some(tag =>
          message.metadata.tags?.includes(tag) ||
          Object.keys(message.metadata).some(key =>
            key.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasTag) matches = false;
      }

      if (matches) {
        matching.push(subscriber);
      }
    }

    return matching;
  }

  /**
   * Handle subscriber processing errors
   */
  private async handleSubscriberError(messageId: string, error: any): Promise<void> {
    this.stats.messagesFailed++;

    // Retry logic
    try {
      const messageFile = path.join(this.queueDir, `${messageId}.json`);
      const messageData = await fs.readFile(messageFile, 'utf8');
      const message = JSON.parse(messageData);

      message.retryCount++;

      if (message.retryCount >= this.maxRetries) {
        await this.reject(messageId, `Max retries exceeded: ${error}`);
      } else {
        // Update retry count and put back in queue
        message.retryCount++;
        await fs.writeFile(messageFile, JSON.stringify(message, null, 2));
      }
    } catch (fileError) {
      this.emit('error', new OrchestrationError(
        `Failed to handle subscriber error: ${fileError}`,
        'SUBSCRIBER_ERROR_HANDLER_FAILED',
        'high',
        true
      ));
    }
  }

  /**
   * Update latency statistics
   */
  private async updateLatencyStats(messageId: string): Promise<void> {
    try {
      const processedFile = path.join(this.processedDir, `${messageId}.json`);
      const messageData = await fs.readFile(processedFile, 'utf8');
      const message = JSON.parse(messageData);

      const latency = Date.now() - new Date(message.timestamp).getTime();

      // Update average latency (exponential moving average)
      const alpha = 0.1; // smoothing factor
      this.stats.averageLatency =
        alpha * latency + (1 - alpha) * this.stats.averageLatency;
    } catch {
      // Ignore latency calculation errors
    }
  }

  /**
   * Start garbage collection for old messages
   */
  private startGarbageCollection(): void {
    this.gcInterval = setInterval(async () => {
      await this.cleanupExpiredMessages();
    }, this.gcIntervalMs);
  }

  /**
   * Clean up expired messages
   */
  private async cleanupExpiredMessages(): Promise<void> {
    try {
      const now = Date.now();
      const dirs = [this.queueDir, this.processedDir];

      for (const dir of dirs) {
        const files = await fs.readdir(dir);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);

          if (now - stat.mtime.getTime() > this.defaultTTL) {
            await fs.unlink(filePath);
            this.stats.queueSize--;
          }
        }
      }
    } catch (error) {
      this.emit('error', new OrchestrationError(
        `Garbage collection failed: ${error}`,
        'GC_FAILED',
        'low',
        true
      ));
    }
  }

  /**
   * Validate message structure
   */
  private validateMessage(message: Message): void {
    if (!message.id) {
      throw new ValidationError('Message ID is required', 'id');
    }

    if (!message.type) {
      throw new ValidationError('Message type is required', 'type');
    }

    if (!Object.values(MessageType).includes(message.type)) {
      throw new ValidationError(`Invalid message type: ${message.type}`, 'type');
    }

    if (!message.sender) {
      throw new ValidationError('Message sender is required', 'sender');
    }

    if (!message.timestamp) {
      throw new ValidationError('Message timestamp is required', 'timestamp');
    }

    if (typeof message.content === 'undefined') {
      throw new ValidationError('Message content is required', 'content');
    }

    if (!Object.values(MessagePriority).includes(message.priority)) {
      throw new ValidationError(`Invalid message priority: ${message.priority}`, 'priority');
    }
  }

  /**
   * Get message bus statistics
   */
  getStats(): MessageBusStats {
    return { ...this.stats };
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.queueDir);
      return files.filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }

    // Process any remaining messages
    await this.processQueue();

    this.emit('shutdown');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const queueSize = await this.getQueueSize();

    if (queueSize > this.maxQueueSize * 0.9) {
      return {
        status: 'unhealthy',
        details: {
          queueSize,
          maxQueueSize: this.maxQueueSize,
          message: 'Queue approaching maximum capacity'
        }
      };
    }

    if (queueSize > this.maxQueueSize * 0.7) {
      return {
        status: 'degraded',
        details: {
          queueSize,
          maxQueueSize: this.maxQueueSize,
          message: 'Queue size elevated'
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        queueSize,
        maxQueueSize: this.maxQueueSize,
        subscribers: this.subscribers.size,
        stats: this.stats
      }
    };
  }
}

// Factory function for creating message bus instance
export const createMessageBus = (config?: {
  queuePath?: string;
  maxQueueSize?: number;
  gcIntervalMs?: number;
}): MessageBus => {
  return new MessageBus(
    config?.queuePath,
    config?.maxQueueSize,
    config?.gcIntervalMs
  );
};