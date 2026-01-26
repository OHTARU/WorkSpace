import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Web Crypto API Mock
const crypto = {
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    importKey: vi.fn(),
    deriveKey: vi.fn(),
  },
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      for (let i = 0; i < array.byteLength; i++) {
        (array as any)[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  },
};

Object.defineProperty(global, 'crypto', {
  value: crypto,
  writable: true,
});

// TextEncoder/TextDecoder Mock
global.TextEncoder = class TextEncoder {
  encode(str: string): Uint8Array {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return bufView;
  }
} as any;

global.TextDecoder = class TextDecoder {
  decode(arr: Uint8Array): string {
    return String.fromCharCode.apply(null, Array.from(arr));
  }
} as any;

// btoa/atob Mock
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
