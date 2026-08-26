import { beforeEach, describe, expect, it } from "vitest";
import {
  VOICE_MATCH_THRESHOLD,
  VOICEPRINT_DIM,
  preEmphasis,
  hammingWindow,
  nextPow2,
  fft,
  hzToMel,
  melToHz,
  melFilterbank,
  dct,
  computeMFCC,
  framesToVoiceprint,
  extractVoiceprintFromPCM,
  cosineSimilarity,
  compareVoiceprints,
  VoiceprintStore,
} from "@/app/lib/voiceprint";

/** Generate a pure sine wave PCM signal. */
function sineWave(freq: number, sampleRate: number, seconds: number): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const sig = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sig[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate));
  }
  return sig;
}

describe("voiceprint DSP primitives", () => {
  it("preEmphasis boosts high frequency deltas", () => {
    const out = preEmphasis(new Float32Array([1, 1, 1]), 0.97);
    expect(out[0]).toBeCloseTo(1);
    expect(out[1]).toBeCloseTo(0.03);
    expect(out[2]).toBeCloseTo(0.03);
  });

  it("preEmphasis handles empty input", () => {
    expect(preEmphasis(new Float32Array([])).length).toBe(0);
  });

  it("hammingWindow has expected endpoints and peak", () => {
    const w = hammingWindow(5);
    expect(w.length).toBe(5);
    expect(w[0]).toBeCloseTo(0.08);
    expect(w[2]).toBeCloseTo(1.0);
    expect(w[4]).toBeCloseTo(0.08);
  });

  it("nextPow2 rounds up to the next power of two", () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(512)).toBe(512);
    expect(nextPow2(513)).toBe(1024);
  });

  it("fft of a DC signal concentrates energy in bin 0", () => {
    const re = new Float32Array([1, 1, 1, 1]);
    const im = new Float32Array([0, 0, 0, 0]);
    fft(re, im);
    expect(re[0]).toBeCloseTo(4);
    expect(re[1]).toBeCloseTo(0);
    expect(re[2]).toBeCloseTo(0);
    expect(re[3]).toBeCloseTo(0);
  });

  it("fft of an impulse is flat across all bins", () => {
    const re = new Float32Array([1, 0, 0, 0]);
    const im = new Float32Array([0, 0, 0, 0]);
    fft(re, im);
    for (let i = 0; i < 4; i++) {
      expect(re[i]).toBeCloseTo(1);
      expect(im[i]).toBeCloseTo(0);
    }
  });

  it("hzToMel and melToHz round-trip", () => {
    expect(hzToMel(0)).toBeCloseTo(0);
    expect(melToHz(hzToMel(1000))).toBeCloseTo(1000, 3);
    expect(melToHz(hzToMel(440))).toBeCloseTo(440, 3);
  });

  it("melFilterbank returns the right shape with values in [0,1]", () => {
    const filters = melFilterbank(26, 512, 16000);
    expect(filters.length).toBe(26);
    for (const f of filters) {
      expect(f.length).toBe(512 / 2 + 1);
      for (let i = 0; i < f.length; i++) {
        expect(f[i]).toBeGreaterThanOrEqual(0);
        expect(f[i]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("dct of a constant input keeps only the zeroth coefficient", () => {
    const out = dct(new Float32Array([1, 1, 1, 1]), 2);
    expect(out[0]).toBeCloseTo(4);
    expect(out[1]).toBeCloseTo(0);
  });
});

describe("MFCC + voiceprint extraction", () => {
  it("computeMFCC returns empty for signals shorter than a frame", () => {
    const frames = computeMFCC(new Float32Array(100), 16000);
    expect(frames).toEqual([]);
  });

  it("computeMFCC produces one 13-coeff vector per frame", () => {
    const signal = sineWave(440, 16000, 0.5);
    const frames = computeMFCC(signal, 16000);
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.length).toBe(13);
    }
  });

  it("framesToVoiceprint returns a zero vector for no frames", () => {
    const vp = framesToVoiceprint([]);
    expect(vp.length).toBe(VOICEPRINT_DIM);
    for (let i = 0; i < vp.length; i++) expect(vp[i]).toBe(0);
  });

  it("framesToVoiceprint computes mean and std", () => {
    const frames = [new Float32Array([1, 2]), new Float32Array([3, 4])];
    const vp = framesToVoiceprint(frames);
    expect(vp.length).toBe(4);
    expect(vp[0]).toBeCloseTo(2); // mean of [1,3]
    expect(vp[1]).toBeCloseTo(3); // mean of [2,4]
    expect(vp[2]).toBeCloseTo(1); // std of [1,3]
    expect(vp[3]).toBeCloseTo(1); // std of [2,4]
  });

  it("extractVoiceprintFromPCM returns a fixed-length voiceprint", () => {
    const vp = extractVoiceprintFromPCM(sineWave(440, 16000, 1), 16000);
    expect(vp.length).toBe(VOICEPRINT_DIM);
  });

  it("identical signals produce near-identical voiceprints", () => {
    const a = extractVoiceprintFromPCM(sineWave(440, 16000, 1), 16000);
    const b = extractVoiceprintFromPCM(sineWave(440, 16000, 1), 16000);
    expect(compareVoiceprints(a, b)).toBeGreaterThan(0.999);
  });
});

describe("voiceprint comparison", () => {
  it("cosineSimilarity is 1 for identical, 0 for orthogonal, -1 for opposite", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
    expect(cosineSimilarity(v, new Float32Array([-1, -2, -3]))).toBeCloseTo(-1);
  });

  it("cosineSimilarity guards against bad input", () => {
    expect(cosineSimilarity(new Float32Array([1]), new Float32Array([1, 2]))).toBe(0);
    expect(cosineSimilarity(new Float32Array([]), new Float32Array([]))).toBe(0);
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
  });

  it("compareVoiceprints normalises to [0,1]", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(compareVoiceprints(v, v)).toBeCloseTo(1);
    expect(compareVoiceprints(v, new Float32Array([-1, -2, -3]))).toBeCloseTo(0);
  });
});

describe("VoiceprintStore", () => {
  let store: VoiceprintStore;

  beforeEach(() => {
    window.localStorage.clear();
    store = new VoiceprintStore();
  });

  it("enroll + get + has round-trip", () => {
    const vp = new Float32Array([1, 2, 3, 4]);
    store.enroll("Operative@Example.io", vp);
    expect(store.has("operative@example.io")).toBe(true);
    const entry = store.get("operative@example.io");
    expect(entry).not.toBeNull();
    expect(entry?.email).toBe("operative@example.io");
    expect(entry?.voiceprint).toEqual([1, 2, 3, 4]);
  });

  it("has returns false for unknown email", () => {
    expect(store.has("nobody@example.io")).toBe(false);
    expect(store.get("nobody@example.io")).toBeNull();
  });

  it("getAll lists every enrolled voiceprint", () => {
    store.enroll("a@example.io", new Float32Array([1]));
    store.enroll("b@example.io", new Float32Array([2]));
    expect(store.getAll().length).toBe(2);
  });

  it("remove deletes a single entry, clear wipes all", () => {
    store.enroll("a@example.io", new Float32Array([1]));
    store.enroll("b@example.io", new Float32Array([2]));
    store.remove("a@example.io");
    expect(store.has("a@example.io")).toBe(false);
    expect(store.has("b@example.io")).toBe(true);
    store.clear();
    expect(store.getAll().length).toBe(0);
  });

  it("matchBest returns the enrolled match above threshold", () => {
    const vp = new Float32Array([1, 2, 3, 4, 5, 6]);
    store.enroll("match@example.io", vp);
    const result = store.matchBest(vp);
    expect(result).not.toBeNull();
    expect(result?.email).toBe("match@example.io");
    expect(result?.score).toBeGreaterThanOrEqual(VOICE_MATCH_THRESHOLD);
  });

  it("matchBest returns null when nothing meets the threshold", () => {
    const vp = new Float32Array([1, 2, 3, 4, 5, 6]);
    store.enroll("match@example.io", vp);
    // Opposite vector -> similarity 0, well below threshold.
    const opposite = new Float32Array([-1, -2, -3, -4, -5, -6]);
    expect(store.matchBest(opposite)).toBeNull();
  });

  it("matchBest picks the highest scoring entry", () => {
    const target = new Float32Array([1, 1, 1, 1]);
    // Similar-but-not-identical vector: still above threshold, but scores < 1.
    store.enroll("low@example.io", new Float32Array([1, 1, 1, 2]));
    store.enroll("high@example.io", target);
    const result = store.matchBest(target);
    expect(result?.email).toBe("high@example.io");
    expect(result?.score).toBeCloseTo(1);
  });
});
