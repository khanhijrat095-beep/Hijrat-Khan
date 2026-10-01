// Web Audio API Procedural Sound Engine for TankBlitz IO

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isInitialized = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.6;
      this.masterGain.connect(this.ctx.destination);
      this.initEngineSound();
      this.isInitialized = true;
    } catch {
      // AudioContext not supported or blocked
    }
  }

  public ensureActive() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.6, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    if (this.masterGain && this.ctx && !this.isMuted) {
      const clamped = Math.max(0, Math.min(1, vol));
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  // --- Cannon Shooting Sounds ---
  public playShoot(type: 'standard' | 'rapid' | 'heavy' | 'sniper' | 'plasma' = 'standard') {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Noise burst + pitch sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'rapid') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'heavy') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);

      this.playNoiseBlast(0.18, 0.4, 250);
    } else if (type === 'sniper') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);

      this.playNoiseBlast(0.12, 0.3, 1200);
    } else if (type === 'plasma') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      // standard
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.14);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);

      this.playNoiseBlast(0.08, 0.2, 400);
    }
  }

  private playNoiseBlast(duration: number, volume: number, cutoff: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  // --- Ricochet / Bounce Sound ---
  public playRicochet() {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = 800 + Math.random() * 400;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.2, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // --- Explosions ---
  public playExplosion(size: 'small' | 'large' | 'death' = 'small') {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const duration = size === 'death' ? 0.7 : size === 'large' ? 0.45 : 0.25;
    const volume = size === 'death' ? 0.7 : size === 'large' ? 0.45 : 0.3;

    // Sub rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + duration);

    subGain.gain.setValueAtTime(volume, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + duration);

    // Crackle noise
    this.playNoiseBlast(duration, volume * 0.9, size === 'death' ? 700 : 450);
  }

  // --- Hit flesh / Armor impact ---
  public playHit() {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.07);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // --- Shield deflect chime ---
  public playShieldDeflect() {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // --- Powerup Pickup ---
  public playPowerup() {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.2, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.12);
    });
  }

  // --- Ability Activation ---
  public playAbility(type: string) {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type.includes('dash') || type.includes('turbo')) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  // --- Kill notification cue ---
  public playKillCue(streak: number = 1) {
    if (this.isMuted) return;
    this.ensureActive();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const base = streak > 2 ? 600 : 440;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(base, now);
    osc1.frequency.setValueAtTime(base * 1.5, now + 0.1);
    osc2.frequency.setValueAtTime(base * 2, now);
    osc2.frequency.setValueAtTime(base * 2.5, now + 0.1);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  // --- Dynamic Engine Sound ---
  private initEngineSound() {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();
    } catch {
      // ignore
    }
  }

  public updateEngineSound(speedRatio: number) {
    if (this.isMuted || !this.engineOsc || !this.engineGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, speedRatio));
    const targetFreq = 42 + clamped * 58; // 42Hz idle to 100Hz max
    const targetVol = 0.03 + clamped * 0.08;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
  }
}

export const soundEngine = new SoundEngine();
