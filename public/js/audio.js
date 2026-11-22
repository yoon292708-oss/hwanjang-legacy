// =============================================================
//  audio.js - Web Audio API 프로시저럴 효과음 엔진
// =============================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  tone(freq, endFreq, dur, type = 'sine', vol = 0.14) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  slash() { this.tone(540, 140, 0.11, 'sawtooth', 0.09); }
  hit(crit = false) {
    if (crit) {
      this.tone(240, 80, 0.14, 'square', 0.14);
      this.tone(880, 1320, 0.1, 'triangle', 0.11);
    } else {
      this.tone(180, 65, 0.09, 'triangle', 0.11);
    }
  }
  parry() {
    this.tone(920, 1760, 0.12, 'sine', 0.18);
    setTimeout(() => this.tone(1320, 1980, 0.16, 'triangle', 0.12), 45);
  }
  skill() {
    this.tone(360, 740, 0.18, 'triangle', 0.12);
    this.tone(180, 420, 0.22, 'sine', 0.08);
  }
  dash() { this.tone(420, 180, 0.12, 'sine', 0.08); }
  heal() {
    this.tone(523, 659, 0.15, 'sine', 0.1);
    setTimeout(() => this.tone(659, 1046, 0.22, 'sine', 0.1), 90);
  }
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, f * 1.02, 0.24, 'triangle', 0.14), i * 85);
    });
  }
  upgrade(ok) {
    if (ok) this.levelUp();
    else { this.tone(240, 120, 0.25, 'sawtooth', 0.12); }
  }
  bossAlert() {
    this.tone(140, 95, 0.45, 'sawtooth', 0.15);
    setTimeout(() => this.tone(130, 85, 0.5, 'sawtooth', 0.15), 240);
  }
}

export const SFX = new SoundEngine();
