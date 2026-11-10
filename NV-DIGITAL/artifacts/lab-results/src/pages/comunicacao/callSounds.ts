export type RingMode = "incoming" | "outgoing";
export type Tone = { at: number; duration: number; frequencies: number[] };
// Generated telephone tones; no downloaded audio or external tracking requests.
export function ringPattern(mode: RingMode): { period: number; tones: Tone[] } {
  return mode === "incoming"
    ? {
        period: 3.2,
        tones: [0, 0.26, 0.6, 1.1, 1.36, 1.7].map((at, i) => ({
          at,
          duration: i % 3 === 2 ? 0.28 : 0.18,
          frequencies: i % 3 === 2 ? [880, 1108] : [660, 880],
        })),
      }
    : { period: 5, tones: [{ at: 0, duration: 2, frequencies: [440, 480] }] };
}
export class CallSounds {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private voices = new Set<OscillatorNode>();
  private mode: RingMode | null = null;
  private volume = 0.4;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewing = false;
  constructor(
    private factory: () => AudioContext = () => new window.AudioContext(),
  ) {}
  get ready() {
    return this.context?.state === "running";
  }
  async unlock(): Promise<boolean> {
    const wasReady = this.ready;
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = this.factory();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== "running") await this.context.resume();
      if (!wasReady && this.ready && this.mode) this.start(this.mode);
      return this.ready;
    } catch {
      return false;
    }
  }
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.volume,
        this.context.currentTime,
        0.02,
      );
  }
  private silence() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const voice of [...this.voices]) {
      try {
        voice.stop();
      } catch {}
      voice.disconnect();
    }
    this.voices.clear();
  }
  private schedule(tones: Tone[]) {
    const ctx = this.context,
      master = this.master;
    if (!ctx || !master || ctx.state !== "running") return;
    for (const tone of tones)
      for (const frequency of tone.frequencies) {
        const voice = ctx.createOscillator(),
          envelope = ctx.createGain(),
          at = ctx.currentTime + 0.02 + tone.at;
        voice.type = "sine";
        voice.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(0.11, at + 0.018);
        envelope.gain.setValueAtTime(
          0.11,
          at + Math.max(0.02, tone.duration - 0.03),
        );
        envelope.gain.linearRampToValueAtTime(0, at + tone.duration);
        voice.connect(envelope);
        envelope.connect(master);
        this.voices.add(voice);
        voice.onended = () => {
          this.voices.delete(voice);
          voice.disconnect();
          envelope.disconnect();
        };
        voice.start(at);
        voice.stop(at + tone.duration + 0.025);
      }
  }
  start(mode: RingMode) {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.previewing = false;
    this.silence();
    this.mode = mode;
    if (!this.ready) return;
    const plan = ringPattern(mode);
    this.schedule(plan.tones);
    this.timer = setInterval(
      () => this.schedule(plan.tones),
      plan.period * 1000,
    );
  }
  stop() {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.previewing = false;
    this.mode = null;
    this.silence();
  }
  preview() {
    if (this.mode && !this.previewing) return;
    this.start("incoming");
    this.previewing = true;
    this.previewTimer = setTimeout(() => this.stop(), 12000);
  }
  stopPreview() {
    if (this.previewing) this.stop();
  }
  chime() {
    if (!this.mode)
      this.schedule([
        { at: 0, duration: 0.13, frequencies: [740] },
        { at: 0.18, duration: 0.18, frequencies: [988] },
      ]);
  }
  dispose() {
    this.stop();
    const ctx = this.context;
    this.context = null;
    this.master = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  }
}
