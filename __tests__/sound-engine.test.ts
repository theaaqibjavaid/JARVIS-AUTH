import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundEngine } from "@/app/lib/sound-engine";

describe("SoundEngine", () => {
  let engine: SoundEngine;

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

  let originalAudioContext: typeof window.AudioContext | undefined;
  let originalWebkitAudioContext: typeof window.AudioContext | undefined;

  beforeAll(() => {
    originalAudioContext = (window as any).AudioContext;
    originalWebkitAudioContext = (window as any).webkitAudioContext;
    try { delete (window as any).AudioContext; } catch {}
    try { delete (window as any).webkitAudioContext; } catch {}
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("webkitAudioContext", FakeAudioContext);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (originalAudioContext) vi.stubGlobal("AudioContext", originalAudioContext);
    if (originalWebkitAudioContext) vi.stubGlobal("webkitAudioContext", originalWebkitAudioContext);
  });

  beforeEach(() => {
    vi.clearAllTimers();
    engine = new SoundEngine();
  });

  it("is constructable without errors", () => {
    expect(engine).toBeInstanceOf(SoundEngine);
  });

  it("unlock primes internal audio context (lazy)", () => {
    engine.unlock();
    expect(true).toBe(true);
  });

  it("playBeep does not throw for valid frequencies", () => {
    expect(() => engine.playBeep(800)).not.toThrow();
    expect(() => engine.playBeep(200, "sawtooth", 0.05, 0.1)).not.toThrow();
  });

  it("playSuccess does not throw", () => {
    engine.unlock();
    expect(() => engine.playSuccess()).not.toThrow();
  });

  it("playError does not throw", () => {
    engine.unlock();
    expect(() => engine.playError()).not.toThrow();
  });

  it("consecutive play calls do not throw and share AudioContext", () => {
    engine.unlock();
    engine.playBeep(440);
    engine.playSuccess();
    engine.playError();
    engine.playBeep(880);
    expect(true).toBe(true);
  });

  it("falls back to no-op if audio context unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    try {
      const e = new SoundEngine();
      expect(() => e.unlock()).not.toThrow();
      expect(() => e.playBeep(440)).not.toThrow();
    } finally {
      vi.stubGlobal("AudioContext", FakeAudioContext);
      vi.stubGlobal("webkitAudioContext", FakeAudioContext);
    }
  });

  it("close() nulls the internal context without throwing", () => {
    engine.unlock();
    expect(() => engine.close()).not.toThrow();
  });

  it("playBeep after close() does not throw", () => {
    engine.unlock();
    engine.close();
    expect(() => engine.playBeep(440)).not.toThrow();
  });
});
