/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (!window.ResizeObserver) {
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }

  class FakeGainNode {
    gain = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} } as any;
    connect() {}
    disconnect() {}
  }
  class FakeOscillator {
    frequency = { value: 0, setValueAtTime() {} } as any;
    type: OscillatorType = "sine";
    connect() {}
    disconnect() {}
    start() {}
    stop() {}
    addEventListener() {}
    removeEventListener() {}
  }
  class FakeAudioContext {
    readonly state = "running" as AudioContextState;
    readonly destination = {} as AudioDestinationNode;
    createGain() { return new FakeGainNode() as unknown as GainNode; }
    createOscillator() { return new FakeOscillator() as unknown as OscillatorNode; }
    async resume() {}
    async close() {}
  }
  try {
    Object.defineProperty(window, "AudioContext", {
      writable: true,
      configurable: true,
      value: FakeAudioContext,
    });
  } catch {
    (window as any).AudioContext = FakeAudioContext;
  }
  try {
    Object.defineProperty(window, "webkitAudioContext", {
      writable: true,
      configurable: true,
      value: FakeAudioContext,
    });
  } catch {
    (window as any).webkitAudioContext = FakeAudioContext;
  }

  if (!window.scrollTo) {
    Object.defineProperty(window, "scrollTo", { writable: true, configurable: true, value: () => {} });
  }
}

if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  const cryptoModule = require("node:crypto");
  (globalThis as any).crypto = cryptoModule.webcrypto;
}
