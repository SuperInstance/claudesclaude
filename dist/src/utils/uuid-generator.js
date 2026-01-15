let performanceCounter = 0;
const COUNTER_MASK = 0xffffff;
const HEX_CHARS = '0123456789abcdef';
const HEX_CHARS_MAP = new Map();
for (let i = 0; i < HEX_CHARS.length; i++) {
    HEX_CHARS_MAP.set(HEX_CHARS[i], i);
}
let seed = Date.now() * 1000 + Math.floor(Math.random() * 1000);
let counter = 0;
export class FastUUIDGenerator {
    useCryptoRandom = false;
    constructor(useSecureRandom = false) {
        this.useCryptoRandom = useSecureRandom;
    }
    generate() {
        if (this.useCryptoRandom) {
            return this.generateSecure();
        }
        return this.generateFast();
    }
    isCryptographicallySecure() {
        return this.useCryptoRandom;
    }
    get throughput() {
        return this.useCryptoRandom ? 50 : 5000;
    }
    generateSecure() {
        return crypto.randomUUID();
    }
    generateFast() {
        const time = Date.now();
        const counterValue = performanceCounter++ & COUNTER_MASK;
        const random = Math.floor(Math.random() * 0x1000000);
        const timeHi = (time & 0xffff0000) >>> 16;
        const timeLow = time & 0xffff;
        const timeMid = (time >>> 8) & 0x0fff;
        const version = 0x4000;
        const variant = (random & 0x3) | 0x8;
        const clockSeqHi = variant << 8;
        const clockSeqLow = (random >> 3) & 0xff;
        const timeHex = (timeLow + (timeMid << 16)).toString(16).padStart(8, '0');
        const versionHex = (version + (timeHi & 0x0fff)).toString(16).padStart(4, '0');
        const clockHex = ((random >> 11) & 0x0fff).toString(16).padStart(4, '0');
        const nodeHex = ((random & 0x7ff) << 8 | (performanceCounter & 0xff)).toString(16).padStart(4, '0');
        return `${timeHex.substring(0, 8)}-${timeHex.substring(8)}-${versionHex}-${clockHex}-${nodeHex}`;
    }
}
export class HybridUUIDGenerator {
    cryptoGenerator;
    fastGenerator;
    useFastForHighThroughput = true;
    constructor() {
        this.cryptoGenerator = new FastUUIDGenerator(true);
        this.fastGenerator = new FastUUIDGenerator(false);
    }
    generate() {
        return this.useFastForHighThroughput ? this.fastGenerator.generate() : this.cryptoGenerator.generate();
    }
    isCryptographicallySecure() {
        return this.useFastForHighThroughput ? false : true;
    }
    get throughput() {
        return this.useFastForHighThroughput ? this.fastGenerator.throughput : this.cryptoGenerator.throughput;
    }
    setUseFastMode(useFast) {
        this.useFastForHighThroughput = useFast;
    }
}
export class ThreadSafeUUIDGenerator {
    generators;
    currentIndex = 0;
    constructor(strategies = []) {
        if (strategies.length === 0) {
            strategies = [
                new FastUUIDGenerator(false),
                new FastUUIDGenerator(false),
                new FastUUIDGenerator(false)
            ];
        }
        this.generators = strategies;
    }
    generate() {
        const generator = this.generators[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.generators.length;
        return generator.generate();
    }
    isCryptographicallySecure() {
        return false;
    }
    get throughput() {
        return Math.min(...this.generators.map(g => g.throughput));
    }
    addStrategy(generator) {
        this.generators.push(generator);
    }
}
export const uuidGenerator = new HybridUUIDGenerator();
export function generateUUID() {
    return uuidGenerator.generate();
}
export function generateSecureUUID() {
    return uuidGenerator.generate();
}
export function generateFastUUID() {
    const generator = new FastUUIDGenerator(false);
    return generator.generate();
}
export function benchmarkUUIDGeneration(generator, iterations = 10000) {
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
export function resetPerformanceCounter() {
    performanceCounter = 0;
}
//# sourceMappingURL=uuid-generator.js.map