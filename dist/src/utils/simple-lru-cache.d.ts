export declare class SimpleLRUCache<K, V> {
    private cache;
    private maxSize;
    constructor(maxSize: number);
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    clear(): void;
    values(): V[];
    size(): number;
}
