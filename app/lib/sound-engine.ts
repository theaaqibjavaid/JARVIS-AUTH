export class SoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        this.ctx = new Ctor();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {
        /* noop */
      });
    }
    return this.ctx;
  }

  playBeep(
    freq = 800,
    type: OscillatorType = "sine",
    duration = 0.1,
    gain = 0.15
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* noop */
    }
  }

  playSuccess(): void {
    this.playBeep(523.25, "triangle", 0.15);
    setTimeout(() => this.playBeep(659.25, "triangle", 0.15), 120);
    setTimeout(() => this.playBeep(783.99, "triangle", 0.25), 240);
  }

  playError(): void {
    this.playBeep(220, "sawtooth", 0.2, 0.2);
    setTimeout(() => this.playBeep(160, "sawtooth", 0.3, 0.2), 150);
  }

  unlock(): void {
    this.ensureContext();
  }
}
