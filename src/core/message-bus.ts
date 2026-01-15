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
}

export function createMessageBus(): MessageBus {
  return new MessageBus();
}