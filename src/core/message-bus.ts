import { EventEmitter } from 'events';
import type { Message } from './types.js';

export class MessageBus extends EventEmitter {
  private messages = new Map<string, Message>();
  private timer?: NodeJS.Timeout;

  publish(message: Omit<Message, 'id' | 'timestamp'>): void {
    const fullMessage = { ...message, id: crypto.randomUUID(), timestamp: new Date() };
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

  processQueue(): void {
    this.getMessages().forEach(m => this.emit('processed', m));
  }

  get gcInterval() {
    return null;
  }

  shutdown(): void {
    this.clear();
    this.removeAllListeners();
    if (this.timer) clearInterval(this.timer);
  }
}

export function createMessageBus(config?: { enableQueueProcessing?: boolean; queueProcessingInterval?: number }): MessageBus {
  const bus = new MessageBus();
  if (config?.enableQueueProcessing) {
    setInterval(() => bus.processQueue(), config.queueProcessingInterval || 5000);
  }
  return bus;
}