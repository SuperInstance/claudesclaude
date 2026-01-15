import { EventEmitter } from 'events';
import type { Message } from './types.js';

export class MessageBus extends EventEmitter {
  private messages: Map<string, Message> = new Map();

  publish(message: Omit<Message, 'id' | 'timestamp'>): void {
    const fullMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    this.messages.set(fullMessage.id, fullMessage);
    this.emit('message', fullMessage);
  }

  subscribe(callback: (message: Message) => void): void {
    this.on('message', callback);
  }

  getMessages(): Message[] {
    return Array.from(this.messages.values());
  }

  clear(): void {
    this.messages.clear();
  }

  // Additional message bus methods
  processQueue(): void {
    // Process any queued messages
    const messages = this.getMessages();
    messages.forEach(message => {
      this.emit('processed', message);
    });
  }

  get gcInterval(): any {
    // Return garbage collection interval configuration
    return null; // Implementation would return actual interval
  }

  shutdown(): void {
    this.clear();
    // Remove all event listeners
    this.removeAllListeners();
  }
}

export function createMessageBus(config?: any): MessageBus {
  const messageBus = new MessageBus();

  // Add queue processing functionality if config provided
  if (config && config.enableQueueProcessing) {
    setInterval(() => {
      messageBus.processQueue();
    }, config.queueProcessingInterval || 5000);
  }

  return messageBus;
}