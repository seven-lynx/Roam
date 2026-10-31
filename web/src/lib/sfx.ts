/**
 * ROAM-OS synthesized sound engine (Web Audio - no assets needed).
 *
 * Mirrors the Android SoundManager's generated SFX (scripts/generate-sfx.mjs): a
 * sine fundamental plus a hint of 2nd harmonic, an exponential decay envelope, and
 * a short noise burst for the mechanical "chunk" sounds. Every sound flows through
 * a single master gain node, so the rotary volume knob, mute and the global sound
 * toggle gate all playback uniformly.
 *
 * Web Audio is created lazily and only ever fires inside a user gesture, so
 * autoplay policies are satisfied. `unlockAudio()` is wired to the first
 * pointer/key event by the workstation shell.
 */

type Note = { freq: number; start: number; length: number; amp: number };

// Note frequencies shared with scripts/generate-sfx.mjs
const A1 = 55;
const A2 = 110;
const A3 = 220;
const C4 = 261.63;
const E4 = 329.63;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;

export type SfxName =
  | 'click'
  | 'clickHeavy'
  | 'clickNav'
  | 'loadStart'
  | 'loadComplete'
  | 'scanBlip'
  | 'mountComplete'
  | 'like'
  | 'skip'
  | 'saveUrl'
  | 'serverHum'
  | 'relayTick'
  | 'modemBlip';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private vol = 0.7;
  private muted = false;
  private enabled = true;
  private ambientId: number | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyGain();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private applyGain() {
    if (!this.ctx || !this.master) return;
    const target = this.enabled && !this.muted ? this.vol : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01);
  }

  unlock() {
    this.ensure();
  }

  setVolume(v: number) {
    this.vol = Math.min(1, Math.max(0, v));
    this.applyGain();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.ensure();
    else if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
    this.applyGain();
  }

  get volume() {
    return this.vol;
  }
  get isMuted() {
    return this.muted;
  }
  get isEnabled() {
    return this.enabled;
  }

  /** Short square-wave tick - the original desk-gadget click signature. */
  tick(freq: number, dur: number, gain: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(Math.min(1, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  /** A single soft sine blip at a frequency (keeps RadarPuck's call signature). */
  blipTone(freq = 440, dur = 0.09) {
    this.tone([{ freq, start: 0, length: dur, amp: 0.04 }], dur + 0.02);
  }

  /** Multi-note sine synth (fundamental + 2nd harmonic) with exponential decay. */
  private tone(notes: Note[], duration: number, peak = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const amp = Math.min(1, n.amp * peak);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0, t0 + n.start);
      g.gain.linearRampToValueAtTime(amp, t0 + n.start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.length);
      osc.connect(g).connect(this.master);
      osc.start(t0 + n.start);
      osc.stop(t0 + n.start + n.length + 0.02);

      const harm = ctx.createOscillator();
      const hg = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.value = n.freq * 2;
      hg.gain.setValueAtTime(0, t0 + n.start);
      hg.gain.linearRampToValueAtTime(amp * 0.15, t0 + n.start + 0.004);
      hg.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.length);
      harm.connect(hg).connect(this.master);
      harm.start(t0 + n.start);
      harm.stop(t0 + n.start + n.length + 0.02);
    }
  }

  /** A short mechanical "chunk" - filtered noise burst. */
  private noise(startSec: number, lengthSec: number, amp: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const frames = Math.max(1, Math.floor(lengthSec * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp((-12 * t) / lengthSec);
      data[i] = (Math.random() * 2 - 1) * env * amp;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.master);
    src.start(t0 + startSec);
  }

  play(name: SfxName) {
    switch (name) {
      case 'click':
        this.tone([{ freq: E4, start: 0, length: 0.05, amp: 0.5 }, { freq: 1800, start: 0, length: 0.006, amp: 0.12 }], 0.08);
        break;
      case 'clickHeavy':
        this.noise(0, 0.03, 0.5);
        this.tone([
          { freq: A1, start: 0, length: 0.1, amp: 0.95 },
          { freq: A2, start: 0, length: 0.08, amp: 0.7 },
          { freq: 2000, start: 0, length: 0.007, amp: 0.22 },
          { freq: C5, start: 0.03, length: 0.03, amp: 0.42 },
          { freq: E5, start: 0.05, length: 0.035, amp: 0.38 },
        ], 0.16);
        break;
      case 'clickNav':
        this.tone([
          { freq: E4, start: 0, length: 0.05, amp: 0.7 },
          { freq: 560, start: 0.004, length: 0.04, amp: 0.5 },
          { freq: 1800, start: 0.002, length: 0.008, amp: 0.18 },
          { freq: 2400, start: 0.003, length: 0.005, amp: 0.1 },
        ], 0.08);
        break;
      case 'scanBlip':
        this.tone([{ freq: A5, start: 0, length: 0.07, amp: 0.4 }], 0.09);
        break;
      case 'mountComplete':
        this.tone([{ freq: C5, start: 0, length: 0.18, amp: 0.8 }, { freq: E5, start: 0.12, length: 0.3, amp: 0.8 }], 0.5);
        break;
      case 'like':
        this.tone([{ freq: C5, start: 0, length: 0.14, amp: 0.55 }, { freq: E5, start: 0.08, length: 0.18, amp: 0.5 }], 0.32);
        break;
      case 'skip':
        this.tone([{ freq: E5, start: 0, length: 0.12, amp: 0.5 }, { freq: C5, start: 0.08, length: 0.16, amp: 0.45 }], 0.28);
        break;
      case 'loadStart':
        this.tone([
          { freq: C4, start: 0, length: 0.1, amp: 0.6 },
          { freq: E4, start: 0.07, length: 0.1, amp: 0.6 },
          { freq: G5, start: 0.14, length: 0.12, amp: 0.5 },
        ], 0.28);
        break;
      case 'loadComplete':
        this.noise(0, 0.02, 0.5);
        this.tone([
          { freq: A2, start: 0, length: 0.1, amp: 0.85 },
          { freq: A3, start: 0, length: 0.07, amp: 0.45 },
          { freq: 1600, start: 0, length: 0.02, amp: 0.28 },
          { freq: C5, start: 0.07, length: 0.14, amp: 0.8 },
          { freq: E5, start: 0.15, length: 0.14, amp: 0.8 },
          { freq: G5, start: 0.23, length: 0.14, amp: 0.8 },
          { freq: C6, start: 0.31, length: 0.3, amp: 0.9 },
          { freq: E6, start: 0.31, length: 0.2, amp: 0.28 },
        ], 0.65);
        break;
      case 'saveUrl':
        this.tone([
          { freq: C5, start: 0, length: 0.14, amp: 0.7 },
          { freq: E5, start: 0.08, length: 0.2, amp: 0.7 },
          { freq: A5, start: 0.16, length: 0.25, amp: 0.6 },
        ], 0.45);
        break;
      case 'serverHum':
        this.tone([{ freq: A2, start: 0, length: 1.6, amp: 0.22 }, { freq: A3, start: 0, length: 1.2, amp: 0.06 }], 1.8);
        break;
      case 'relayTick':
        this.tone([{ freq: 2200, start: 0, length: 0.03, amp: 0.5 }, { freq: 1400, start: 0.008, length: 0.03, amp: 0.3 }], 0.06);
        break;
      case 'modemBlip':
        this.tone([{ freq: 980, start: 0, length: 0.09, amp: 0.35 }, { freq: 1650, start: 0.06, length: 0.1, amp: 0.3 }], 0.2);
        break;
    }
  }

  /** Gentle, spaced-out "data flow" ambience (mirrors the Android loading loop). */
  startAmbient() {
    if (this.ambientId !== null) return;
    const accents: SfxName[] = ['scanBlip', 'relayTick', 'modemBlip'];
    const tick = () => {
      this.ambientId = window.setTimeout(tick, 4000 + Math.random() * 8000);
      if (!this.enabled || this.muted || this.vol <= 0) return;
      this.play(accents[Math.floor(Math.random() * accents.length)]);
    };
    this.ambientId = window.setTimeout(tick, 3000 + Math.random() * 5000);
  }

  stopAmbient() {
    if (this.ambientId !== null) {
      window.clearTimeout(this.ambientId);
      this.ambientId = null;
    }
  }
}

export const sfx = new SoundEngine();

export const unlockAudio = () => sfx.unlock();
export const setSfxVolume = (v: number) => sfx.setVolume(v);
export const setSfxMuted = (m: boolean) => sfx.setMuted(m);
export const setSfxEnabled = (on: boolean) => sfx.setEnabled(on);
export const startAmbient = () => sfx.startAmbient();
export const stopAmbient = () => sfx.stopAmbient();

/** Generic key click - keeps the desk gadgets' existing call signature. */
export function click(freq = 760, dur = 0.05, gain = 0.06) {
  sfx.tick(freq, dur, gain);
}

/** Generic soft blip at a frequency - keeps RadarPuck's existing call signature. */
export function blip(freq = 440, dur = 0.09) {
  sfx.blipTone(freq, dur);
}

export const clickHeavy = () => sfx.play('clickHeavy');
export const clickNav = () => sfx.play('clickNav');
export const loadStart = () => sfx.play('loadStart');
export const loadComplete = () => sfx.play('loadComplete');
export const scanBlip = () => sfx.play('scanBlip');
export const mountComplete = () => sfx.play('mountComplete');
export const like = () => sfx.play('like');
export const skip = () => sfx.play('skip');
export const saveUrl = () => sfx.play('saveUrl');
export const serverHum = () => sfx.play('serverHum');
export const relayTick = () => sfx.play('relayTick');
export const modemBlip = () => sfx.play('modemBlip');