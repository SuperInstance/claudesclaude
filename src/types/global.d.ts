/**
 * Global type declarations for browser and Node.js APIs
 */

declare global {
  interface WebAssembly {
    Module: typeof WebAssembly.Module;
    Instance: typeof WebAssembly.Instance;
    Memory: typeof WebAssembly.Memory;
    Table: typeof WebAssembly.Table;
  }

  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  type Transferable = ArrayBuffer | MessagePort;
}

export {};