import { EventEmitter } from 'events';
export class MessageBus extends EventEmitter {
    messages = new Map();
    publish(message) {
        const fullMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date()
        };
        this.messages.set(fullMessage.id, fullMessage);
        this.emit('message', fullMessage);
    }
    subscribe(callback) {
        this.on('message', callback);
    }
    getMessages() {
        return Array.from(this.messages.values());
    }
    clear() {
        this.messages.clear();
    }
}
export function createMessageBus() {
    return new MessageBus();
}
//# sourceMappingURL=message-bus.js.map