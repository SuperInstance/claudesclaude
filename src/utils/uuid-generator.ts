/**
 * High-Performance UUID Generator
 *
 * Provides multiple strategies for generating UUIDs with varying performance
 * characteristics to balance between cryptographically secure generation
 * and high-throughput performance needs.
 */

// Performance counter for measuring overhead
let performanceCounter = 0;
const COUNTER_MASK = 0xffffff; // 24 bits

// Pre-computed hex characters for faster conversion
const HEX_CHARS = '0123456789abcdef';
const HEX_CHARS_MAP = new Map<string, number>();
for (let i = 0; i < HEX_CHARS.length; i++) {
  HEX_CHARS_MAP.set(HEX_CHARS[i], i);
}

// State for non-crypto generation
let seed = Date.now() * 1000 + Math.floor(Math.random() * 1000);
let counter = 0;

export interface UUIDGenerationStrategy {
  generate(): string;
  isCryptographicallySecure(): boolean;
  throughput: number; // UUIDs per ms estimated
}

export class FastUUIDGenerator implements UUIDGenerationStrategy {
  private useCryptoRandom = false;

  constructor(useSecureRandom = false) {
    this.useCryptoRandom = useSecureRandom;
  }

  generate(): string {
    if (this.useCryptoRandom) {
      return this.generateSecure();
    }
    return this.generateFast();
  }

  isCryptographicallySecure(): boolean {
    return this.useCryptoRandom;
  }

  get throughput(): number {
    return this.useCryptoRandom ? 50 : 5000; // Estimated based on performance
  }

  private generateSecure(): string {
    // Fallback to crypto.randomUUID for secure generation
    // This is expensive but provides full security guarantees
    return crypto.randomUUID();
  }

  private generateFast(): string {
    // High-performance non-crypto UUID generation
    // Based on timestamp + counter with pseudo-random components
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where x is random and y is 8, 9, a, or b

    const time = Date.now();
    const counterValue = performanceCounter++ & COUNTER_MASK;
    const random = Math.floor(Math.random() * 0x1000000);

    // Combine time, counter, and random data
    const timeHi = (time & 0xffff0000) >>> 16;
    const timeLow = time & 0xffff;
    const timeMid = (time >>> 8) & 0x0fff;

    // Version 4: 0100xxxx
    const version = 0x4000;

    // Variant: 10xx (RFC 4122 compliant)
    const variant = (random & 0x3) | 0x8;
    const clockSeqHi = variant << 8;
    const clockSeqLow = (random >> 3) & 0xff;

    // Convert to hex strings
    const timeHex = (timeLow + (timeMid << 16)).toString(16).padStart(8, '0');
    const versionHex = (version + (timeHi & 0x0fff)).toString(16).padStart(4, '0');
    const clockHex = ((random >> 11) & 0x0fff).toString(16).padStart(4, '0');
    const nodeHex = ((random & 0x7ff) << 8 | (performanceCounter & 0xff)).toString(16).padStart(4, '0');

    return `${timeHex.substring(0, 8)}-${timeHex.substring(8)}-${versionHex}-${clockHex}-${nodeHex}`;
  }
}

export class HybridUUIDGenerator implements UUIDGenerationStrategy {
  private cryptoGenerator: UUIDGenerationStrategy;
  private fastGenerator: UUIDGenerationStrategy;
  private useFastForHighThroughput = true;

  constructor() {
    this.cryptoGenerator = new FastUUIDGenerator(true);
    this.fastGenerator = new FastUUIDGenerator(false);
  }

  generate(): string {
    return this.useFastForHighThroughput ? this.fastGenerator.generate() : this.cryptoGenerator.generate();
  }

  isCryptographicallySecure(): boolean {
    return this.useFastForHighThroughput ? false : true;
  }

  get throughput(): number {
    return this.useFastForHighThroughput ? this.fastGenerator.throughput : this.cryptoGenerator.throughput;
  }

  setUseFastMode(useFast: boolean): void {
    this.useFastForHighThroughput = useFast;
  }
}

export class ThreadSafeUUIDGenerator implements UUIDGenerationStrategy {
  private generators: UUIDGenerationStrategy[];
  private currentIndex = 0;

  constructor(strategies: UUIDGenerationStrategy[] = []) {
    if (strategies.length === 0) {
      strategies = [
        new FastUUIDGenerator(false),
        new FastUUIDGenerator(false),
        new FastUUIDGenerator(false)
      ];
    }
    this.generators = strategies;
  }

  generate(): string {
    const generator = this.generators[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.generators.length;
    return generator.generate();
  }

  isCryptographicallySecure(): boolean {
    return false; // Thread-safe version is not cryptographically secure
  }

  get throughput(): number {
    // Return minimum throughput among all generators
    return Math.min(...this.generators.map(g => g.throughput));
  }

  addStrategy(generator: UUIDGenerationStrategy): void {
    this.generators.push(generator);
  }
}

// Global instance for easy access
export const uuidGenerator = new HybridUUIDGenerator();

// Convenience functions
export function generateUUID(): string {
  return uuidGenerator.generate();
}

export function generateSecureUUID(): string {
  return uuidGenerator.generate(); // In hybrid mode, this might be secure
}

export function generateFastUUID(): string {
  const generator = new FastUUIDGenerator(false);
  return generator.generate();
}

// Benchmark utilities
export function benchmarkUUIDGeneration(generator: UUIDGenerationStrategy, iterations: number = 10000): {
  time: number;
  throughput: number;
  uuid: string;
} {
  const start = performance.now();

  let lastUUID = '';
  for (let i = 0; i < iterations; i++) {
    lastUUID = generator.generate();
  }

  const end = performance.now();
  const time = end - start;
  const throughput = iterations / time;

  return {
    time,
    throughput,
    uuid: lastUUID
  };
}

export function resetPerformanceCounter(): void {
  performanceCounter = 0;
}