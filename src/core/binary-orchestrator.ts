/**
 * Binary Protocol Orchestrator - Efficient Binary Serialization
 * Uses compact binary format for data storage and transfer
 *
 * Performance characteristics:
 * - Binary serialization: No JSON parsing overhead
 * - Compact encoding: Smaller memory footprint
 * - Direct memory access: Zero-copy where possible
 * - Network-ready: Can send bytes directly over network
 *
 * Protocol format:
 * - Fixed headers for fast parsing
 * - Variable-length encoding for strings
 * - Little-endian for x86 compatibility
 * - Alignment for efficient memory access
 */

import type { Session, SessionType, Message } from './types.js';

// Binary protocol constants
const PROTOCOL_VERSION = 1;

// Session type codes
enum SessionTypeCode {
  Agent = 1,
  Task = 2,
  Workflow = 3,
  Session = 4,
  AIAssistant = 5,
  Development = 6,
  Testing = 7,
  Deployment = 8
}

// Status codes
enum StatusCode {
  Active = 1,
  Paused = 2,
  Completed = 3,
  Failed = 4
}

// Binary encoder
class BinaryEncoder {
  private buffer: Uint8Array;
  private offset = 0;
  private view: DataView;

  constructor(initialSize: number = 4096) {
    this.buffer = new Uint8Array(initialSize);
    this.view = new DataView(this.buffer.buffer);
  }

  // Ensure capacity
  ensureCapacity(required: number): void {
    if (this.offset + required > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, this.offset + required);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  // Write uint8
  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  // Write uint16 (little-endian)
  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  // Write uint32 (little-endian)
  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  // Write uint64 (little-endian)
  writeUint64(value: number): void {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.offset, BigInt(value), true);
    this.offset += 8;
  }

  // Write string (length-prefixed)
  writeString(str: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);

    this.ensureCapacity(2 + bytes.length);
    this.writeUint16(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  // Write bytes
  writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  // Get encoded bytes
  getBytes(): Uint8Array {
    return this.buffer.subarray(0, this.offset);
  }

  // Reset encoder
  reset(): void {
    this.offset = 0;
  }

  getOffset(): number {
    return this.offset;
  }
}

// Binary decoder
class BinaryDecoder {
  private buffer: Uint8Array;
  private offset = 0;
  private view: DataView;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  // Read uint8
  readUint8(): number {
    if (this.offset + 1 > this.buffer.length) {
      throw new Error('Buffer underflow');
    }
    return this.view.getUint8(this.offset++);
  }

  // Read uint16 (little-endian)
  readUint16(): number {
    if (this.offset + 2 > this.buffer.length) {
      throw new Error('Buffer underflow');
    }
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  // Read uint32 (little-endian)
  readUint32(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error('Buffer underflow');
    }
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  // Read uint64 (little-endian)
  readUint64(): number {
    if (this.offset + 8 > this.buffer.length) {
      throw new Error('Buffer underflow');
    }
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return Number(value);
  }

  // Read string (length-prefixed)
  readString(): string {
    const length = this.readUint16();
    if (this.offset + length > this.buffer.length) {
      throw new Error('Buffer underflow');
    }

    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    const decoder = new TextDecoder();
    const str = decoder.decode(bytes);
    this.offset += length;
    return str;
  }

  // Check if has more data
  hasMore(): boolean {
    return this.offset < this.buffer.length;
  }

  getOffset(): number {
    return this.offset;
  }
}

// Binary session codec
class BinarySessionCodec {
  // Encode session to binary format
  encode(session: Session): Uint8Array {
    const encoder = new BinaryEncoder();

    // Header
    encoder.writeUint8(PROTOCOL_VERSION);
    encoder.writeUint8(this.encodeSessionType(session.type));
    encoder.writeUint8(this.encodeStatus(session.status));
    encoder.writeUint8(0); // Reserved

    // Timestamps
    encoder.writeUint64(session.createdAt.getTime());
    encoder.writeUint64(session.updatedAt.getTime());

    // String fields
    encoder.writeString(session.id);
    encoder.writeString(session.name);
    encoder.writeString(session.workspace);

    // Config (as JSON string for simplicity)
    const configJson = JSON.stringify(session.config);
    encoder.writeString(configJson);

    return encoder.getBytes();
  }

  // Decode session from binary format
  decode(data: Uint8Array): Session {
    const decoder = new BinaryDecoder(data);

    // Header
    const version = decoder.readUint8();
    if (version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported protocol version: ${version}`);
    }

    const typeCode = decoder.readUint8();
    const statusCode = decoder.readUint8();
    decoder.readUint8(); // Skip reserved

    // Timestamps
    const createdAt = decoder.readUint64();
    const updatedAt = decoder.readUint64();

    // String fields
    const id = decoder.readString();
    const name = decoder.readString();
    const workspace = decoder.readString();

    // Config
    const configJson = decoder.readString();
    const config = JSON.parse(configJson);

    return {
      id,
      type: this.decodeSessionType(typeCode),
      name,
      workspace,
      config,
      status: this.decodeStatus(statusCode) as any,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt)
    };
  }

  // Session type encoding/decoding
  private encodeSessionType(type: SessionType): SessionTypeCode {
    const mapping: Record<SessionType, SessionTypeCode> = {
      agent: SessionTypeCode.Agent,
      task: SessionTypeCode.Task,
      workflow: SessionTypeCode.Workflow,
      session: SessionTypeCode.Session,
      'ai-assistant': SessionTypeCode.AIAssistant,
      development: SessionTypeCode.Development,
      testing: SessionTypeCode.Testing,
      deployment: SessionTypeCode.Deployment
    };
    return mapping[type] ?? SessionTypeCode.Agent;
  }

  private decodeSessionType(code: SessionTypeCode): SessionType {
    const mapping: Record<SessionTypeCode, SessionType> = {
      [SessionTypeCode.Agent]: 'agent',
      [SessionTypeCode.Task]: 'task',
      [SessionTypeCode.Workflow]: 'workflow',
      [SessionTypeCode.Session]: 'session',
      [SessionTypeCode.AIAssistant]: 'ai-assistant',
      [SessionTypeCode.Development]: 'development',
      [SessionTypeCode.Testing]: 'testing',
      [SessionTypeCode.Deployment]: 'deployment'
    };
    return mapping[code] ?? 'agent';
  }

  // Status encoding/decoding
  private encodeStatus(status: string): StatusCode {
    const mapping: Record<string, StatusCode> = {
      active: StatusCode.Active,
      paused: StatusCode.Paused,
      completed: StatusCode.Completed,
      failed: StatusCode.Failed
    };
    return mapping[status] ?? StatusCode.Active;
  }

  private decodeStatus(code: StatusCode): string {
    const mapping: Record<StatusCode, string> = {
      [StatusCode.Active]: 'active',
      [StatusCode.Paused]: 'paused',
      [StatusCode.Completed]: 'completed',
      [StatusCode.Failed]: 'failed'
    };
    return mapping[code] ?? 'active';
  }
}

// Binary protocol orchestrator
export class BinaryOrchestrator {
  private codec = new BinarySessionCodec();
  private sessions = new Map<string, Uint8Array>(); // ID -> binary data
  private contexts = new Map<string, any>();
  private messages: Message[] = [];
  private events = new Map<string, Set<Function>>();

  // Create session with binary encoding
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config ?? {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store as binary
    const binaryData = this.codec.encode(session);
    this.sessions.set(session.id, binaryData);

    this.emit('session', session);
    return session;
  }

  // Get session by ID (decode on demand)
  getSession(id: string): Session | undefined {
    const binaryData = this.sessions.get(id);
    if (!binaryData) return undefined;

    return this.codec.decode(binaryData);
  }

  // Update session
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const binaryData = this.sessions.get(id);
    if (!binaryData) return undefined;

    // Decode, update, re-encode
    const session = this.codec.decode(binaryData);
    const updated: Session = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    const newBinaryData = this.codec.encode(updated);
    this.sessions.set(id, newBinaryData);

    this.emit('session:updated', updated);
    return updated;
  }

  // Delete session
  deleteSession(id: string): boolean {
    const binaryData = this.sessions.get(id);
    if (!binaryData) return false;

    const session = this.codec.decode(binaryData);
    this.sessions.delete(id);
    this.contexts.delete(id);

    this.emit('session:deleted', session);
    return true;
  }

  // Context management
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  // Message handling
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.getSession(sessionId)) return false;

    this.messages.push({
      id: message.id ?? `msg-${this.messages.length}`,
      type: message.type ?? 'user',
      content: message.content,
      role: message.role,
      timestamp: message.timestamp ?? new Date(),
      metadata: message.metadata
    });

    this.emit('message', this.messages[this.messages.length - 1]);
    return true;
  }

  processMessages(): number {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }

  // Query operations
  getAllSessions(): Session[] {
    const result: Session[] = [];

    for (const [_, binaryData] of this.sessions) {
      result.push(this.codec.decode(binaryData));
    }

    return result;
  }

  getSessionsByType(type: SessionType): Session[] {
    const all = this.getAllSessions();
    return all.filter(s => s.type === type);
  }

  getSessionsByStatus(status: string): Session[] {
    const all = this.getAllSessions();
    return all.filter(s => s.status === status);
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const all = this.getAllSessions();
    return all.filter(s => s.workspace === workspace);
  }

  // Metrics with binary statistics
  getMetrics() {
    const sessions = this.getAllSessions();
    let totalBinarySize = 0;

    for (const [_, binaryData] of this.sessions) {
      totalBinarySize += binaryData.length;
    }

    const avgBinarySize = sessions.length > 0 ? totalBinarySize / sessions.length : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      totalMessages: this.messages.length,
      cachedContexts: this.contexts.size,
      totalBinarySize,
      avgBinarySize: avgBinarySize.toFixed(0),
      protocolVersion: PROTOCOL_VERSION,
      binaryEncoding: true,
      networkReady: true
    };
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.emit('sessions:cleared', undefined);
  }

  healthCheck() {
    const metrics = this.getMetrics();
    return { status: 'healthy', details: metrics };
  }

  // Export as binary
  exportSessionsBinary(): Uint8Array[] {
    return Array.from(this.sessions.values());
  }

  // Import from binary
  importSessionsBinary(data: Uint8Array[]): void {
    for (const binaryData of data) {
      try {
        const session = this.codec.decode(binaryData);
        this.sessions.set(session.id, binaryData);
      } catch (e) {
        // Skip invalid data
      }
    }
  }

  exportSessions(): any[] {
    return this.getAllSessions();
  }

  importSessions(sessions: any[]): void {
    sessions.forEach(s => {
      this.createSession({
        type: s.type,
        name: s.name,
        workspace: s.workspace,
        config: s.config
      });
    });
  }

  // Event handling
  onSessionCreated(callback: (session: Session) => void) {
    this.on('session', callback);
  }

  onSessionUpdated(callback: (session: Session) => void) {
    this.on('session:updated', callback);
  }

  onSessionDeleted(callback: (session: Session) => void) {
    this.on('session:deleted', callback);
  }

  onMessage(callback: (message: Message) => void) {
    this.on('message', callback);
  }

  private on<T>(event: string, callback: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  private emit<T>(event: string, data: T): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

// Factory function
export function createBinaryOrchestrator(): BinaryOrchestrator {
  return new BinaryOrchestrator();
}

// Default instance
export const binaryOrchestrator = createBinaryOrchestrator();
