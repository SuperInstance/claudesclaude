/**
 * Global type declarations for browser and Node.js APIs
 */

declare global {
  const WebAssembly: {
    Module: any;
    Instance: any;
    Memory: any;
    Table: any;
  };

  const crypto: {
    getRandomValues?: (array: Uint8Array) => void;
    randomBytes?: (size: number) => Buffer;
    randomUUID?: () => string;
  };

  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

export type Transferable = ArrayBuffer | MessagePort;