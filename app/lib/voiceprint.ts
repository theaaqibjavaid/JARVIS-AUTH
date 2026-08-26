/**
 * J.A.R.V.I.S. Voice Biometric Engine — real DSP voiceprint extraction.
 *
 * This module implements genuine speaker-characterisation signal processing:
 *   1. Pre-emphasis filter
 *   2. Framing + Hamming window
 *   3. Radix-2 FFT -> power spectrum
 *   4. Mel-scale triangular filterbank
 *   5. Log compression
 *   6. Discrete Cosine Transform -> MFCCs
 *   7. Mean + std aggregation across frames -> fixed-length voiceprint vector
 *
 * Matching is done with cosine similarity against an enrolled voiceprint.
 * This is real spectral analysis (not a mock). It is intentionally
 * self-contained and offline; for ML-grade speaker verification, swap the
 * comparison backend for a cloud speaker-recognition API.
 */

export const VOICE_MATCH_THRESHOLD = 0.82;
export const VOICEPRINT_DIM = 26; // 13 MFCC mean + 13 MFCC std

const VOICEPRINT_STORE_KEY = "jarvis_voiceprints";

// ---------------------------------------------------------------------------
// Core DSP primitives (pure + unit-testable)
// ---------------------------------------------------------------------------

/** First-order pre-emphasis filter to boost high frequencies. */
export function preEmphasis(signal: Float32Array, coeff = 0.97): Float32Array {
  const out = new Float32Array(signal.length);
  if (signal.length === 0) return out;
  out[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = signal[i] - coeff * signal[i - 1];
  }
  return out;
}

/** Returns a Hamming window of the given size. */
export function hammingWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let n = 0; n < size; n++) {
    w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (size - 1 || 1));
  }
  return w;
}

/** Next power of two >= n. */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place iterative radix-2 Cooley-Tukey FFT.
 * `re` and `im` must have a power-of-two length.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Convert frequency (Hz) to mel scale. */
export function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

/** Convert mel scale back to frequency (Hz). */
export function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Build a mel-scale triangular filterbank.
 * Returns an array of `numFilters` Float32Arrays each of length `fftSize/2 + 1`.
 */
export function melFilterbank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  lowFreq = 0,
  highFreq?: number
): Float32Array[] {
  const high = highFreq ?? sampleRate / 2;
  const lowMel = hzToMel(lowFreq);
  const highMel = hzToMel(high);
  const melPoints = new Float32Array(numFilters + 2);
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = lowMel + ((highMel - lowMel) * i) / (numFilters + 1);
  }
  const hzPoints = melPoints.map((m) => melToHz(m));
  const binCount = fftSize / 2 + 1;
  const bins = hzPoints.map((hz) =>
    Math.floor(((fftSize + 1) * hz) / sampleRate)
  );

  const filters: Float32Array[] = [];
  for (let f = 0; f < numFilters; f++) {
    const filter = new Float32Array(binCount);
    const left = bins[f];
    const center = bins[f + 1];
    const right = bins[f + 2];
    for (let b = left; b < center; b++) {
      if (center !== left) filter[b] = (b - left) / (center - left);
    }
    for (let b = center; b < right; b++) {
      if (right !== center) filter[b] = (right - b) / (right - center);
    }
    filters.push(filter);
  }
  return filters;
}

/** Type-II DCT of the input, returning the first `numOutputs` coefficients. */
export function dct(input: Float32Array, numOutputs: number): Float32Array {
  const out = new Float32Array(numOutputs);
  const N = input.length;
  for (let k = 0; k < numOutputs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    out[k] = sum;
  }
  return out;
}

// ---------------------------------------------------------------------------
// MFCC + voiceprint extraction
// ---------------------------------------------------------------------------

export interface MFCCOptions {
  frameSize?: number; // samples per frame
  frameStride?: number; // samples between frames
  fftSize?: number;
  numFilters?: number;
  numCoeffs?: number;
  lowFreq?: number;
  highFreq?: number;
}

/**
 * Compute per-frame MFCCs for a PCM signal.
 * Returns an array of MFCC vectors (one per frame).
 */
export function computeMFCC(
  signal: Float32Array,
  sampleRate: number,
  options: MFCCOptions = {}
): Float32Array[] {
  const frameSize = options.frameSize ?? 512;
  const frameStride = options.frameStride ?? 256;
  const fftSize = options.fftSize ?? nextPow2(frameSize);
  const numFilters = options.numFilters ?? 26;
  const numCoeffs = options.numCoeffs ?? 13;
  const lowFreq = options.lowFreq ?? 0;
  const highFreq = options.highFreq ?? sampleRate / 2;

  if (signal.length < frameSize) return [];

  const emphasized = preEmphasis(signal);
  const window = hammingWindow(frameSize);
  const filters = melFilterbank(numFilters, fftSize, sampleRate, lowFreq, highFreq);

  const frames: Float32Array[] = [];
  for (let start = 0; start + frameSize <= emphasized.length; start += frameStride) {
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let i = 0; i < frameSize; i++) {
      re[i] = emphasized[start + i] * window[i];
    }
    fft(re, im);

    // Power spectrum (first half + DC)
    const binCount = fftSize / 2 + 1;
    const power = new Float32Array(binCount);
    for (let b = 0; b < binCount; b++) {
      power[b] = (re[b] * re[b] + im[b] * im[b]) / fftSize;
    }

    // Mel filterbank energies (log)
    const filterEnergies = new Float32Array(numFilters);
    for (let f = 0; f < numFilters; f++) {
      let energy = 0;
      const filter = filters[f];
      for (let b = 0; b < binCount; b++) {
        energy += power[b] * filter[b];
      }
      filterEnergies[f] = Math.log(energy + 1e-10);
    }

    const coeffs = dct(filterEnergies, numCoeffs);
    frames.push(coeffs);
  }
  return frames;
}

/**
 * Reduce per-frame MFCCs to a single fixed-length voiceprint vector
 * (mean + standard deviation of each coefficient).
 */
export function framesToVoiceprint(frames: Float32Array[]): Float32Array {
  if (frames.length === 0) return new Float32Array(VOICEPRINT_DIM);
  const numCoeffs = frames[0].length;
  const mean = new Float32Array(numCoeffs);
  const std = new Float32Array(numCoeffs);

  for (const frame of frames) {
    for (let i = 0; i < numCoeffs; i++) mean[i] += frame[i];
  }
  for (let i = 0; i < numCoeffs; i++) mean[i] /= frames.length;

  for (const frame of frames) {
    for (let i = 0; i < numCoeffs; i++) {
      const d = frame[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < numCoeffs; i++) {
    std[i] = Math.sqrt(std[i] / frames.length);
  }

  const out = new Float32Array(numCoeffs * 2);
  out.set(mean, 0);
  out.set(std, numCoeffs);
  return out;
}

/** Extract a voiceprint vector directly from a PCM signal. */
export function extractVoiceprintFromPCM(
  signal: Float32Array,
  sampleRate: number,
  options: MFCCOptions = {}
): Float32Array {
  const frames = computeMFCC(signal, sampleRate, options);
  return framesToVoiceprint(frames);
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/** Cosine similarity between two equal-length vectors, in range [-1, 1]. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compare two voiceprints and return a normalised similarity score in [0, 1].
 * 1 = identical, 0 = orthogonal/opposite.
 */
export function compareVoiceprints(
  a: Float32Array,
  b: Float32Array
): number {
  const sim = cosineSimilarity(a, b);
  return (sim + 1) / 2;
}

// ---------------------------------------------------------------------------
// Browser glue: Blob -> PCM via AudioContext.decodeAudioData
// ---------------------------------------------------------------------------

/** Decode an audio Blob into mono PCM + sample rate using the Web Audio API. */
export async function decodeAudioBlobToPCM(
  blob: Blob
): Promise<{ signal: Float32Array; sampleRate: number }> {
  if (typeof window === "undefined") {
    throw new Error("Audio decoding requires a browser environment.");
  }
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    throw new Error("Web Audio API is not supported in this browser.");
  }
  const ctx = new Ctor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    // Mix down to mono by averaging channels.
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    const channels = Math.max(1, audioBuffer.numberOfChannels);
    for (let c = 0; c < channels; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }
    return { signal: mono, sampleRate: audioBuffer.sampleRate };
  } finally {
    ctx.close().catch(() => {
      /* noop */
    });
  }
}

/** Extract a voiceprint from a recorded audio Blob. */
export async function extractVoiceprint(blob: Blob): Promise<Float32Array> {
  const { signal, sampleRate } = await decodeAudioBlobToPCM(blob);
  return extractVoiceprintFromPCM(signal, sampleRate);
}

// ---------------------------------------------------------------------------
// Persistent voiceprint store (localStorage, keyed by email)
// ---------------------------------------------------------------------------

export interface StoredVoiceprint {
  email: string;
  voiceprint: number[];
  enrolledAt: string;
}

export class VoiceprintStore {
  private read(): Record<string, StoredVoiceprint> {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(VOICEPRINT_STORE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, StoredVoiceprint>) : {};
    } catch {
      return {};
    }
  }

  private write(map: Record<string, StoredVoiceprint>): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VOICEPRINT_STORE_KEY, JSON.stringify(map));
  }

  enroll(email: string, voiceprint: Float32Array): void {
    const map = this.read();
    map[email.toLowerCase()] = {
      email: email.toLowerCase(),
      voiceprint: Array.from(voiceprint),
      enrolledAt: new Date().toISOString(),
    };
    this.write(map);
  }

  get(email: string): StoredVoiceprint | null {
    return this.read()[email.toLowerCase()] ?? null;
  }

  has(email: string): boolean {
    return Boolean(this.get(email));
  }

  getAll(): StoredVoiceprint[] {
    return Object.values(this.read());
  }

  remove(email: string): void {
    const map = this.read();
    delete map[email.toLowerCase()];
    this.write(map);
  }

  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(VOICEPRINT_STORE_KEY);
  }

  /**
   * 1:N match — compare a probe voiceprint against every enrolled voiceprint
   * and return the best match above threshold, or null.
   */
  matchBest(
    probe: Float32Array,
    threshold = VOICE_MATCH_THRESHOLD
  ): { email: string; score: number } | null {
    let best: { email: string; score: number } | null = null;
    for (const entry of this.getAll()) {
      const stored = new Float32Array(entry.voiceprint);
      const score = compareVoiceprints(probe, stored);
      if (score >= threshold && (!best || score > best.score)) {
        best = { email: entry.email, score };
      }
    }
    return best;
  }
}
