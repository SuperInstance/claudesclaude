/**
 * High-Performance Serialization Utilities
 *
 * Provides efficient serialization and deserialization for context data
 * with support for multiple formats, compression, and optimization
 * for orchestration system performance.
 */

import * as zlib from 'zlib';
import * as crypto from 'crypto';

// Serialization cache
const SERIALIZATION_CACHE = new Map<string, {
  compressed: boolean;
  data: Buffer;
  hash: string;
  timestamp: number;
}>();

// Serialization statistics
const STATS = {
  serializations: 0,
  deserializations: 0,
  cacheHits: 0,
  cacheMisses: 0,
  compressionSavings: 0
};

// Configuration
const CONFIG = {
  cacheSize: 1000,
  cacheTTL: 300000, // 5 minutes
  compressionThreshold: 1024, // Compress if data > 1KB
  compressionLevel: 6, // Default compression level
  hashAlgorithm: 'sha256'
};

export interface SerializationOptions {
  format?: 'json' | 'msgpack' | 'cbor' | 'binary';
  compress?: boolean;
  encrypt?: boolean;
  encryptKey?: string;
  cache?: boolean;
  pretty?: boolean;
  replacer?: (key: string, value: any) => any;
  reviver?: (key: string, value: any) => any;
}

export interface SerializationResult {
  data: Buffer;
  format: string;
  compressed: boolean;
  encrypted: boolean;
  originalSize: number;
  finalSize: number;
  hash: string;
}

/**
 * High-performance serialization utilities
 */
export class SerializationUtils {
  private static msgpack: any = null;
  private static cbor: any = null;

  constructor() {
    // Initialize optional dependencies lazily
  }

  /**
   * Serialize data with multiple format support
   */
  static async serialize(
    data: any,
    options: SerializationOptions = {}
  ): Promise<SerializationResult> {
    const {
      format = 'json',
      compress = false,
      encrypt = false,
      encryptKey,
      cache = true,
      pretty = false,
      replacer
    } = options;

    STATS.serializations++;

    try {
      // Generate hash for caching
      const dataString = JSON.stringify(data);
      const hash = crypto
        .createHash(CONFIG.hashAlgorithm)
        .update(dataString)
        .digest('hex');

      // Check cache first
      const cacheKey = `${format}-${hash}-${compress}-${encrypt}`;
      const cached = cache ? SERIALIZATION_CACHE.get(cacheKey) : null;

      if (cached && Date.now() - cached.timestamp < CONFIG.cacheTTL) {
        STATS.cacheHits++;
        return {
          data: cached.data,
          format,
          compressed: cached.compressed,
          encrypted: encrypt,
          originalSize: Buffer.byteLength(dataString, 'utf8'),
          finalSize: cached.data.length,
          hash
        };
      }

      STATS.cacheMisses++;

      // Serialize based on format
      let serialized: Buffer;
      const originalSize = Buffer.byteLength(dataString, 'utf8');

      switch (format) {
        case 'json':
          serialized = await this.serializeJSON(data, pretty, replacer);
          break;
        case 'msgpack':
          serialized = await this.serializeMsgPack(data);
          break;
        case 'cbor':
          serialized = await this.serializeCBOR(data);
          break;
        case 'binary':
          serialized = await this.serializeBinary(data);
          break;
        default:
          throw new Error(`Unsupported serialization format: ${format}`);
      }

      // Compress if requested and above threshold
      let finalData = serialized;
      let isCompressed = false;

      if (compress && serialized.length > CONFIG.compressionThreshold) {
        finalData = await this.compressData(serialized);
        isCompressed = true;
        STATS.compressionSavings += serialized.length - finalData.length;
      }

      // Encrypt if requested
      let encrypted = false;
      if (encrypt) {
        finalData = await this.encryptData(finalData, encryptKey);
        encrypted = true;
      }

      // Cache the result
      if (cache) {
        this.setCache(cacheKey, finalData, isCompressed, hash);
      }

      return {
        data: finalData,
        format,
        compressed: isCompressed,
        encrypted,
        originalSize,
        finalSize: finalData.length,
        hash
      };
    } catch (error) {
      throw new Error(`Serialization failed: ${error.message}`);
    }
  }

  /**
   * Deserialize data with format detection
   */
  static async deserialize(
    data: Buffer,
    options: SerializationOptions & { format?: 'auto' } = {}
  ): Promise<any> {
    const {
      format = 'auto',
      compress = false,
      encrypt = false,
      encryptKey,
      cache = true,
      reviver
    } = options;

    STATS.deserializations++;

    try {
      // Auto-detect format if not specified
      const detectedFormat = format === 'auto' ? await this.detectFormat(data) : format;

      // Handle encryption
      let decryptedData = data;
      if (encrypt) {
        decryptedData = await this.decryptData(data, encryptKey);
      }

      // Handle decompression
      let decompressedData = decryptedData;
      if (compress) {
        decompressedData = await this.decompressData(decryptedData);
      }

      // Deserialize based on format
      switch (detectedFormat) {
        case 'json':
          return this.deserializeJSON(decompressedData, reviver);
        case 'msgpack':
          return this.deserializeMsgPack(decompressedData);
        case 'cbor':
          return this.deserializeCBOR(decompressedData);
        case 'binary':
          return this.deserializeBinary(decompressedData);
        default:
          throw new Error(`Unsupported deserialization format: ${detectedFormat}`);
      }
    } catch (error) {
      throw new Error(`Deserialization failed: ${error.message}`);
    }
  }

  /**
   * Serialize data as JSON
   */
  private static async serializeJSON(
    data: any,
    pretty: boolean,
    replacer?: (key: string, value: any) => any
  ): Promise<Buffer> {
    const jsonString = pretty
      ? JSON.stringify(data, replacer, 2)
      : JSON.stringify(data, replacer);
    return Buffer.from(jsonString, 'utf8');
  }

  /**
   * Deserialize JSON data
   */
  private static deserializeJSON(data: Buffer, reviver?: (key: string, value: any) => any): any {
    const jsonString = data.toString('utf8');
    return JSON.parse(jsonString, reviver);
  }

  /**
   * Serialize data as MessagePack (optional dependency)
   */
  private static async serializeMsgPack(data: any): Promise<Buffer> {
    if (!this.msgpack) {
      try {
        this.msgpack = await import('msgpack-lite');
      } catch {
        throw new Error('msgpack-lite not installed. Install with: npm install msgpack-lite');
      }
    }
    return this.msgpack.encode(data);
  }

  /**
   * Deserialize MessagePack data
   */
  private static async deserializeMsgPack(data: Buffer): Promise<any> {
    if (!this.msgpack) {
      try {
        this.msgpack = await import('msgpack-lite');
      } catch {
        throw new Error('msgpack-lite not installed. Install with: npm install msgpack-lite');
      }
    }
    return this.msgpack.decode(data);
  }

  /**
   * Serialize data as CBOR (optional dependency)
   */
  private static async serializeCBOR(data: any): Promise<Buffer> {
    if (!this.cbor) {
      try {
        this.cbor = await import('cbor');
      } catch {
        throw new Error('cbor not installed. Install with: npm install cbor');
      }
    }
    return this.cbor.encodeOne(data);
  }

  /**
   * Deserialize CBOR data
   */
  private static async deserializeCBOR(data: Buffer): Promise<any> {
    if (!this.cbor) {
      try {
        this.cbor = await import('cbor');
      } catch {
        throw new Error('cbor not installed. Install with: npm install cbor');
      }
    }
    return this.cbor.decodeFirst(data);
  }

  /**
   * Serialize data as binary format
   */
  private static async serializeBinary(data: any): Promise<Buffer> {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(0x42494E41, 0); // 'BINA' magic number
    header.writeUInt32BE(1, 4); // Version 1

    const jsonData = JSON.stringify(data);
    const content = Buffer.from(jsonData, 'utf8');

    const result = Buffer.alloc(header.length + content.length);
    header.copy(result);
    content.copy(result, header.length);

    return result;
  }

  /**
   * Deserialize binary format
   */
  private static async deserializeBinary(data: Buffer): Promise<any> {
    if (data.length < 8) {
      throw new Error('Invalid binary data: too short');
    }

    const magic = data.subarray(0, 4).toString();
    const version = data.readUInt32BE(4);

    if (magic !== 'BINA') {
      throw new Error('Invalid binary data: magic number mismatch');
    }

    if (version !== 1) {
      throw new Error(`Unsupported binary version: ${version}`);
    }

    const content = data.subarray(8);
    return JSON.parse(content.toString('utf8'));
  }

  /**
   * Detect data format
   */
  private static async detectFormat(data: Buffer): Promise<string> {
    // Check binary format
    if (data.length >= 8) {
      const magic = data.subarray(0, 4).toString();
      if (magic === 'BINA') {
        return 'binary';
      }
    }

    // Check JSON
    try {
      JSON.parse(data.toString('utf8'));
      return 'json';
    } catch {
      // Not JSON
    }

    // Try MessagePack
    try {
      if (!this.msgpack) {
        this.msgpack = await import('msgpack-lite');
      }
      this.msgpack.decode(data);
      return 'msgpack';
    } catch {
      // Not MessagePack
    }

    // Try CBOR
    try {
      if (!this.cbor) {
        this.cbor = await import('cbor');
      }
      this.cbor.decodeFirst(data);
      return 'cbor';
    } catch {
      // Not CBOR
    }

    return 'json'; // Default fallback
  }

  /**
   * Compress data
   */
  private static async compressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.deflate(data, { level: CONFIG.compressionLevel }, (error, compressed) => {
        if (error) reject(error);
        else resolve(compressed);
      });
    });
  }

  /**
   * Decompress data
   */
  private static async decompressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.inflate(data, (error, decompressed) => {
        if (error) reject(error);
        else resolve(decompressed);
      });
    });
  }

  /**
   * Encrypt data
   */
  private static async encryptData(data: Buffer, key?: string): Promise<Buffer> {
    if (!key) {
      throw new Error('Encryption key is required');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);

    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
      iv
    ]);

    return encrypted;
  }

  /**
   * Decrypt data
   */
  private static async decryptData(data: Buffer, key?: string): Promise<Buffer> {
    if (!key) {
      throw new Error('Decryption key is required');
    }

    const iv = data.slice(-16);
    const encrypted = data.slice(0, -16);

    const decipher = crypto.createDecipher('aes-256-cbc', key);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }

  /**
   * Batch serialize multiple objects
   */
  static async batchSerialize(
    objects: Array<{ data: any; options?: SerializationOptions }>,
    globalOptions?: SerializationOptions
  ): Promise<SerializationResult[]> {
    const results: SerializationResult[] = [];

    for (const { data, options } of objects) {
      const mergedOptions = { ...globalOptions, ...options };
      const result = await this.serialize(data, mergedOptions);
      results.push(result);
    }

    return results;
  }

  /**
   * Batch deserialize multiple objects
   */
  static async batchDeserialize(
    buffers: Array<{ data: Buffer; options?: SerializationOptions }>,
    globalOptions?: SerializationOptions
  ): Promise<any[]> {
    const results: any[] = [];

    for (const { data, options } of buffers) {
      const mergedOptions = { ...globalOptions, ...options };
      const result = await this.deserialize(data, mergedOptions);
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate compression ratio
   */
  static calculateCompressionRatio(original: number, compressed: number): number {
    return compressed / original;
  }

  /**
   * Get serialization statistics
   */
  static getStats(): {
    serializations: number;
    deserializations: number;
    cacheHits: number;
    cacheMisses: number;
    compressionSavings: number;
    cacheSize: number;
  } {
    return {
      ...STATS,
      cacheSize: SERIALIZATION_CACHE.size
    };
  }

  /**
   * Clear serialization cache
   */
  static clearCache(): void {
    SERIALIZATION_CACHE.clear();
  }

  /**
   * Set cache entry
   */
  private static setCache(
    key: string,
    data: Buffer,
    compressed: boolean,
    hash: string
  ): void {
    if (SERIALIZATION_CACHE.size >= CONFIG.cacheSize) {
      this.evictOldestCache();
    }

    SERIALIZATION_CACHE.set(key, {
      compressed,
      data,
      hash,
      timestamp: Date.now()
    });
  }

  /**
   * Evict oldest cache entry
   */
  private static evictOldestCache(): void {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, value] of SERIALIZATION_CACHE.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      SERIALIZATION_CACHE.delete(oldestKey);
    }
  }
}

// Convenience functions
export const serialize = SerializationUtils.serialize.bind(SerializationUtils);
export const deserialize = SerializationUtils.deserialize.bind(SerializationUtils);
export const batchSerialize = SerializationUtils.batchSerialize.bind(SerializationUtils);
export const batchDeserialize = SerializationUtils.batchDeserialize.bind(SerializationUtils);
export const calculateCompressionRatio = SerializationUtils.calculateCompressionRatio.bind(SerializationUtils);

// Type aliases for convenience
export type Serializer = typeof serialize;
export type Deserializer = typeof deserialize;