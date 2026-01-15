/**
 * Unit Tests for MessageBus
 * 100% coverage requirement for all core functionality
 */

import fs from 'fs/promises';
import path from 'path';
import { createMessageBus } from '../../src/core/message-bus';
import {
  Message,
  MessageType,
  MessagePriority,
  SessionType,
  createMessage,
  createSession,
  OrchestrationError,
  MessageTimeoutError
} from '../../src/core/types';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('MessageBus', () => {
  let messageBus: any;
  let queuePath: string;
  let cleanup: () => void;

  beforeEach(async () => {
    // Create temporary directory
    queuePath = path.join(__dirname, '.test-queue');
    cleanup = jest.fn();

    // Mock fs operations
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);

    // Create message bus
    messageBus = createMessageBus({
      queuePath,
      maxQueueSize: 100,
      gcIntervalMs: 60000
    });

    // Stop any running intervals
    if (messageBus.gcInterval) {
      clearInterval(messageBus.gcInterval);
    }
  });

  afterEach(async () => {
    await messageBus.shutdown();
    cleanup();
  });

  describe('Message Validation', () => {
    test('should validate complete message', () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' },
        'session-2'
      );

      expect(() => messageBus['validateMessage'](message)).not.toThrow();
    });

    test('should reject message without ID', () => {
      const message = {
        type: MessageType.DIRECTION,
        sender: 'session-1',
        content: { action: 'test' }
      };

      expect(() => messageBus['validateMessage'](message))
        .toThrow('Message ID is required');
    });

    test('should reject message with invalid type', () => {
      const message = createMessage(
        'invalid-type' as any,
        'session-1',
        { action: 'test' }
      );

      expect(() => messageBus['validateMessage'](message))
        .toThrow('Invalid message type');
    });

    test('should reject message without sender', () => {
      const message = createMessage(
        MessageType.DIRECTION,
        undefined as any,
        { action: 'test' }
      );

      expect(() => messageBus['validateMessage'](message))
        .toThrow('Message sender is required');
    });
  });

  describe('Message Publishing', () => {
    test('should publish message successfully', async () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      await expect(messageBus.publish(message)).resolves.not.toThrow();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should handle publish errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      await expect(messageBus.publish(message))
        .rejects.toThrow('Failed to publish message');
    });

    test('should emit messagePublished event', async () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      const eventSpy = jest.fn();
      messageBus.on('messagePublished', eventSpy);

      await messageBus.publish(message);
      expect(eventSpy).toHaveBeenCalledWith(message);
    });

    test('should update stats on publish', async () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      const initialStats = messageBus.getStats();
      await messageBus.publish(message);

      const updatedStats = messageBus.getStats();
      expect(updatedStats.messagesPublished).toBe(initialStats.messagesPublished + 1);
    });
  });

  describe('Message Subscription', () => {
    test('should subscribe to messages', () => {
      const subscriber = jest.fn().mockResolvedValue(undefined);
      const filter = { types: [MessageType.DIRECTION] };

      const unsubscribe = messageBus.subscribe(subscriber, filter);

      expect(typeof unsubscribe).toBe('function');
      expect(messageBus['subscribers'].size).toBe(1);
    });

    test('should filter messages by type', async () => {
      const subscriber = jest.fn().mockResolvedValue(undefined);
      const filter = { types: [MessageType.DIRECTION] };

      messageBus.subscribe(subscriber, filter);

      // Matching message
      const matchingMessage = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      // Non-matching message
      const nonMatchingMessage = createMessage(
        MessageType.STATUS_UPDATE,
        'session-1',
        { action: 'test' }
      );

      // Simulate message processing
      const matchingSubscribers = messageBus['getMatchingSubscribers'](matchingMessage);
      const nonMatchingSubscribers = messageBus['getMatchingSubscribers'](nonMatchingMessage);

      expect(matchingSubscribers.length).toBe(1);
      expect(nonMatchingSubscribers.length).toBe(0);
    });

    test('should filter messages by sender', async () => {
      const subscriber = jest.fn().mockResolvedValue(undefined);
      const filter = { senders: ['session-1'] };

      messageBus.subscribe(subscriber, filter);

      // Matching message
      const matchingMessage = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      // Non-matching message
      const nonMatchingMessage = createMessage(
        MessageType.DIRECTION,
        'session-2',
        { action: 'test' }
      );

      const matchingSubscribers = messageBus['getMatchingSubscribers'](matchingMessage);
      const nonMatchingSubscribers = messageBus['getMatchingSubscribers'](nonMatchingMessage);

      expect(matchingSubscribers.length).toBe(1);
      expect(nonMatchingSubscribers.length).toBe(0);
    });

    test('should unsubscribe from messages', () => {
      const subscriber = jest.fn().mockResolvedValue(undefined);
      const unsubscribe = messageBus.subscribe(subscriber);

      expect(messageBus['subscribers'].size).toBe(1);

      unsubscribe();
      expect(messageBus['subscribers'].size).toBe(0);
    });
  });

  describe('Message Processing', () => {
    test('should process message with matching subscriber', async () => {
      const subscriber = jest.fn().mockResolvedValue(undefined);
      messageBus.subscribe(subscriber);

      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      // Simulate file creation
      mockFs.readdir.mockResolvedValue([`${message.id}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      await messageBus['processMessage'](message.id);

      expect(subscriber).toHaveBeenCalledWith(message);
      expect(mockFs.rename).toHaveBeenCalled();
    });

    test('should acknowledge message when no subscribers match', async () => {
      mockFs.readdir.mockResolvedValue([`${'test-id'}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'test-id',
        type: MessageType.DIRECTION,
        sender: 'session-1',
        content: { action: 'test' },
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString()
      }));

      await messageBus['processMessage']('test-id');

      expect(mockFs.rename).toHaveBeenCalledWith(
        expect.stringContaining('test-id.json'),
        expect.stringContaining('processed')
      );
    });

    test('should handle subscriber errors', async () => {
      const subscriber = jest.fn().mockRejectedValue(new Error('Subscriber error'));
      messageBus.subscribe(subscriber);

      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      mockFs.readdir.mockResolvedValue([`${message.id}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      await messageBus['processMessage'](message.id);

      expect(mockFs.rename).not.toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled(); // Should retry
    });

    test('should reject message after max retries', async () => {
      const subscriber = jest.fn().mockRejectedValue(new Error('Subscriber error'));
      messageBus.subscribe(subscriber);

      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );
      message.retryCount = 3; // Max retries reached

      mockFs.readdir.mockResolvedValue([`${message.id}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      await messageBus['processMessage'](message.id);

      expect(mockFs.rename).not.toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.stringContaining('Max retries exceeded')
      );
    });
  });

  describe('Request-Response Pattern', () => {
    test('should handle request-response pattern', async () => {
      const request = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'request' }
      );

      const response = createMessage(
        MessageType.STATUS_UPDATE,
        'session-2',
        { action: 'response' }
      );
      response.metadata.correlationId = `req-${request.id}`;

      // Setup mock for message processing
      mockFs.readdir.mockResolvedValue([`${request.id}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ...request,
        timestamp: request.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      // Start processing
      await messageBus.publish(request);

      // Mock response file
      mockFs.readdir.mockResolvedValue([`${response.id}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ...response,
        timestamp: response.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      const promise = messageBus.request(request, 1000);

      // Simulate response processing
      await messageBus['processQueue']();

      const result = await promise;
      expect(result.metadata.correlationId).toBe(`req-${request.id}`);
    });

    test('should timeout request', async () => {
      const request = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'request' }
      );

      await expect(messageBus.request(request, 100))
        .rejects.toThrow('Message timeout');
    });
  });

  describe('Acknowledgment and Rejection', () => {
    test('should acknowledge message', async () => {
      mockFs.readFile.mockResolvedValue('{}');
      mockFs.rename.mockResolvedValue(undefined);

      await expect(messageBus.acknowledge('test-id')).resolves.not.toThrow();
      expect(mockFs.rename).toHaveBeenCalled();
    });

    test('should reject message', async () => {
      mockFs.readFile.mockResolvedValue('{}');
      mockFs.rename.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      await expect(messageBus.reject('test-id', 'Test reason')).resolves.not.toThrow();
      expect(mockFs.rename).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    test('should track message statistics', async () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      const initialStats = messageBus.getStats();
      await messageBus.publish(message);

      const updatedStats = messageBus.getStats();
      expect(updatedStats.messagesPublished).toBe(initialStats.messagesPublished + 1);
      expect(updatedStats.queueSize).toBe(initialStats.queueSize + 1);
    });

    test('should update latency statistics', () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      const initialLatency = messageBus.getStats().averageLatency;
      messageBus['updateLatencyStats'](message.id);
      const updatedLatency = messageBus.getStats().averageLatency;

      expect(updatedLatency).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    test('should return healthy status for normal operation', async () => {
      mockFs.readdir.mockResolvedValue([]); // Empty queue

      const health = await messageBus.healthCheck();
      expect(health.status).toBe('healthy');
    });

    test('should return degraded status for large queue', async () => {
      // Create 7000 files (70% of 10000 max)
      const files = Array.from({ length: 7000 }, (_, i) => `${i}.json`);
      mockFs.readdir.mockResolvedValue(files);

      const health = await messageBus.healthCheck();
      expect(health.status).toBe('degraded');
    });

    test('should return unhealthy status for critical queue size', async () => {
      // Create 9000 files (90% of 10000 max)
      const files = Array.from({ length: 9000 }, (_, i) => `${i}.json`);
      mockFs.readdir.mockResolvedValue(files);

      const health = await messageBus.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Garbage Collection', () => {
    test('should clean up expired messages', async () => {
      const oldFiles = Array.from({ length: 10 }, (_, i) => `${i}.json`);
      mockFs.readdir.mockResolvedValue(oldFiles);

      // Mock old files
      mockFs.stat.mockImplementation((filePath: string) => {
        return Promise.resolve({
          mtime: {
            getTime: () => Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
          }
        } as any);
      });

      await messageBus['cleanupExpiredMessages']();

      expect(mockFs.unlink).toHaveBeenCalledTimes(10);
    });
  });

  describe('Concurrency and Performance', () => {
    test('should handle concurrent message processing', async () => {
      const subscriber = jest.fn().mockResolvedValue(undefined);
      messageBus.subscribe(subscriber);

      // Create multiple messages
      const messages = Array.from({ length: 5 }, (_, i) =>
        createMessage(MessageType.DIRECTION, `session-${i}`, { action: `test-${i}` })
      );

      // Mock directory to return all messages
      mockFs.readdir.mockResolvedValue(messages.map(m => `${m.id}.json`));

      messages.forEach(message => {
        mockFs.readFile.mockResolvedValue(JSON.stringify({
          ...message,
          timestamp: message.timestamp.toISOString(),
          receivedAt: new Date().toISOString()
        }));
      });

      const processPromise = messageBus['processQueue']();
      await processPromise;

      expect(subscriber).toHaveBeenCalledTimes(5);
    });

    test('should maintain single processing state', async () => {
      const subscriber = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });
      messageBus.subscribe(subscriber);

      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      mockFs.readdir.mockResolvedValue([`${message.id}.json`]);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      // Start first processing
      const firstProcess = messageBus['processQueue']();

      // Try to start second processing immediately
      const secondProcess = messageBus['processQueue']();

      await Promise.all([firstProcess, secondProcess]);

      // Second process should not have run separately
      expect(messageBus['processing']).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Filesystem error'));

      const health = await messageBus.healthCheck();
      expect(health.status).not.toBe('healthy'); // Should handle error
    });

    test('should emit error events', async () => {
      const errorSpy = jest.fn();
      messageBus.on('error', errorSpy);

      mockFs.writeFile.mockRejectedValue(new Error('Write error'));

      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      await expect(messageBus.publish(message)).resolves.not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.any(OrchestrationError));
    });
  });
});