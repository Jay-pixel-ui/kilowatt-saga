/**
 * Procedural WebAudio SFX — zero asset files, tiny code, huge feel.
 * Everything is synthesized: noise bursts, pitch sweeps, filtered wind.
 * Audio unlocks on the first user gesture (browser autoplay policy).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  /** Call from a click/keydown handler once. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    // Wind loop: filtered noise, gain driven by speed each frame.
    const buffer = this.noiseBuffer(2);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 500;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.ctx.destination);
    src.start();
  }

  /** Grapple fired: short "thwip" — noise burst with a fast pitch sweep. */
  thwip(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g = this.envelope(0.14, 0.16);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** Grapple attached: low "thunk". */
  attach(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    const g = this.envelope(0.3, 0.14);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /** Rope released: airy zip. */
  release(): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.15);
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 2500;
    const g = this.envelope(0.12, 0.15);
    src.connect(f).connect(g);
    src.start();
  }

  /** Beacon lit: two-note chime. */
  chime(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [freq, delay] of [
      [660, 0],
      [990, 0.12]
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.7);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.75);
    }
  }

  /** Mission complete: rising chord swell. */
  finale(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [330, 415, 495, 660].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.15 + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      osc.connect(g).connect(this.ctx!.destination);
      osc.start(t + i * 0.15);
      osc.stop(t + 3.3);
    });
  }

  /** Shard collected: quick bright blip, pitch rises with combo count. */
  pickup(count: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880 + Math.min(count, 12) * 40;
    const g = this.envelope(0.18, 0.18);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Drone destroyed: crunchy boom. */
  boom(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.4);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1600, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.35);
    const g = this.envelope(0.45, 0.4);
    src.connect(f).connect(g);
    src.start();
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const g2 = this.envelope(0.4, 0.35);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.37);
  }

  /** Drone alarm: harsh descending buzz. */
  alarm(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.35);
    const g = this.envelope(0.2, 0.4);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /** Call every frame: wind volume/pitch follows speed. */
  wind(speed: number): void {
    if (!this.windGain || !this.windFilter || !this.ctx) return;
    const t = Math.min(1, speed / 35);
    this.windGain.gain.setTargetAtTime(t * t * 0.25, this.ctx.currentTime, 0.1);
    this.windFilter.frequency.setTargetAtTime(400 + t * 900, this.ctx.currentTime, 0.15);
  }

  // ---------------------------------------------------------- internals

  private envelope(peak: number, dur: number): GainNode {
    const g = this.ctx!.createGain();
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.ctx!.destination);
    return g;
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const rate = this.ctx!.sampleRate;
    const buf = this.ctx!.createBuffer(1, rate * seconds, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
