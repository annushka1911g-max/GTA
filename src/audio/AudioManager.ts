/**
 * GTA Vice City Procedural Audio Synthesizer
 * Provides 80s Synthwave Radio (Flash FM, Wave 103, Fever 105),
 * retro V8 car engines, VCPD police sirens, combat sounds (punches, baseball bat, gunshot), and tire screeches.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning = false;

  // Horn / Siren sound nodes
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private sirenInterval: number | null = null;
  private isHornHonking = false;
  private isSirenActive = false;

  // Tire skid / drift sound nodes
  private skidSource: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidBuffer: AudioBuffer | null = null;

  // Radio channels (Vice City 80s Theme)
  private radioInterval: number | null = null;
  private currentRadioStation = 0;
  public readonly radioStations = [
    'FLASH FM - 80s SYNTH POP',
    'WAVE 103 - NEW WAVE / DARKWAVE',
    'FEVER 105 - MIAMI DISCO & FUNK',
    'V-ROCK - 80s HEAVY METAL',
    'EMOTION 98.3 - CROCKETT\'S THEME',
    'RADIO OFF',
  ];

  constructor() {}

  public init(): void {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createSkidNoiseBuffer();
      this.isInitialized = true;
      this.startRadio();
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Start 80s Retro V8 engine sound
   */
  public startEngine(): void {
    if (!this.ctx || this.isEngineRunning) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(50, now);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(25, now);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(360, now);
      this.engineFilter.Q.setValueAtTime(2.5, now);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.01, now);
      this.engineGain.gain.linearRampToValueAtTime(0.2, now + 0.25);

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start(now);
      this.engineSubOsc.start(now);
      this.isEngineRunning = true;
    } catch (e) {
      console.warn('Engine audio error:', e);
    }
  }

  public updateEngine(speedMph: number, throttle: number): void {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc || !this.engineSubOsc || !this.engineFilter) return;

    const absSpeed = Math.abs(speedMph);
    const gearSpeed = (absSpeed % 26) / 26;
    const baseFreq = 48 + gearSpeed * 85 + Math.abs(throttle) * 40;

    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);

    const filterFreq = 340 + gearSpeed * 950 + Math.abs(throttle) * 800;
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);

    if (this.engineGain) {
      const targetGain = 0.14 + Math.abs(throttle) * 0.09 + (absSpeed / 130) * 0.06;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.04);
    }
  }

  public stopEngine(): void {
    if (!this.ctx || !this.isEngineRunning) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.linearRampToValueAtTime(0.001, now + 0.15);
      }
      setTimeout(() => {
        try {
          this.engineOsc?.stop();
          this.engineSubOsc?.stop();
          this.engineOsc?.disconnect();
          this.engineSubOsc?.disconnect();
        } catch {}
        this.isEngineRunning = false;
      }, 200);
    } catch {
      this.isEngineRunning = false;
    }
  }

  /**
   * 80s Dual-Tone Horn
   */
  public startHorn(): void {
    if (!this.ctx || this.isHornHonking) return;
    this.resume();

    const now = this.ctx.currentTime;
    this.hornOsc1 = this.ctx.createOscillator();
    this.hornOsc2 = this.ctx.createOscillator();
    this.hornGain = this.ctx.createGain();

    this.hornOsc1.type = 'sawtooth';
    this.hornOsc2.type = 'sawtooth';
    this.hornOsc1.frequency.setValueAtTime(380, now);
    this.hornOsc2.frequency.setValueAtTime(475, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);

    this.hornGain.gain.setValueAtTime(0.01, now);
    this.hornGain.gain.linearRampToValueAtTime(0.2, now + 0.03);

    this.hornOsc1.connect(filter);
    this.hornOsc2.connect(filter);
    filter.connect(this.hornGain);
    this.hornGain.connect(this.ctx.destination);

    this.hornOsc1.start(now);
    this.hornOsc2.start(now);
    this.isHornHonking = true;
  }

  public stopHorn(): void {
    if (!this.ctx || !this.isHornHonking) return;
    const now = this.ctx.currentTime;
    if (this.hornGain) {
      this.hornGain.gain.linearRampToValueAtTime(0.001, now + 0.04);
    }
    setTimeout(() => {
      try {
        this.hornOsc1?.stop();
        this.hornOsc2?.stop();
        this.hornOsc1?.disconnect();
        this.hornOsc2?.disconnect();
      } catch {}
      this.isHornHonking = false;
    }, 50);
  }

  /**
   * VCPD 80s Police Siren Toggle
   */
  public toggleSiren(): boolean {
    if (this.isSirenActive) {
      this.stopSiren();
      return false;
    } else {
      this.startSiren();
      return true;
    }
  }

  private startSiren(): void {
    if (!this.ctx) return;
    this.resume();
    this.isSirenActive = true;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    let high = true;
    const sweep = () => {
      if (!this.isSirenActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setTargetAtTime(high ? 920 : 650, now, 0.22);
      high = !high;
    };

    osc.start();
    sweep();
    this.sirenInterval = window.setInterval(sweep, 500);
  }

  private stopSiren(): void {
    this.isSirenActive = false;
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }
  }

  private createSkidNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.skidBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.skidBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  public playTireSkid(intensity: number): void {
    if (!this.ctx || !this.skidBuffer) return;
    this.resume();

    const clamped = Math.max(0, Math.min(1, intensity));
    if (clamped < 0.1) {
      if (this.skidGain) {
        this.skidGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.05);
      }
      return;
    }

    if (!this.skidSource) {
      this.skidSource = this.ctx.createBufferSource();
      this.skidSource.buffer = this.skidBuffer;
      this.skidSource.loop = true;

      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = 'bandpass';
      this.skidFilter.frequency.setValueAtTime(1150, this.ctx.currentTime);
      this.skidFilter.Q.setValueAtTime(3.8, this.ctx.currentTime);

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0.01, this.ctx.currentTime);

      this.skidSource.connect(this.skidFilter);
      this.skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.ctx.destination);
      this.skidSource.start();
    }

    const now = this.ctx.currentTime;
    if (this.skidGain) {
      this.skidGain.gain.setTargetAtTime(clamped * 0.16, now, 0.03);
    }
  }

  public stopTireSkid(): void {
    if (!this.ctx || !this.skidGain) return;
    this.skidGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.04);
  }

  public playCarDoor(): void {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playFootstep(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Combat sounds: Punch, Baseball Bat, Colt .45 Gunshot
   */
  public playPunch(comboStep: number = 0): void {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const pitch = 280 + comboStep * 60;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    // Impact smack on heavy 3rd hit
    if (comboStep === 2) {
      setTimeout(() => this.playImpactSmack(), 80);
    }
  }

  public playBatSwing(): void {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);

    setTimeout(() => this.playBatClank(), 70);
  }

  private playBatClank(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  private playImpactSmack(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /**
   * Colt .45 Gunshot (sharp muzzle explosion + echo)
   */
  public playGunshot(): void {
    if (!this.ctx || !this.skidBuffer) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Sharp noise transient
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.skidBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);

    // Deep sub kick thump
    const kick = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(220, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    kickGain.gain.setValueAtTime(0.4, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    kick.connect(kickGain);
    kickGain.connect(this.ctx.destination);
    kick.start(now);
    kick.stop(now + 0.22);
  }

  /**
   * Japanese Katana sword slash (high-velocity metallic whoosh + blade slice)
   */
  public playKatanaSlash(): void {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Chrome Shotgun (massive dual blast + heavy bass thump)
   */
  public playShotgun(): void {
    if (!this.ctx || !this.skidBuffer) return;
    this.resume();
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.skidBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.38);

    const kick = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(180, now);
    kick.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    kickGain.gain.setValueAtTime(0.5, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    kick.connect(kickGain);
    kickGain.connect(this.ctx.destination);
    kick.start(now);
    kick.stop(now + 0.3);
  }

  /**
   * Rapid Micro-SMG (Mac-10 / Tec-9) burst
   */
  public playSMG(): void {
    if (!this.ctx || !this.skidBuffer) return;
    this.resume();
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.skidBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.1);

    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.type = 'square';
    pop.frequency.setValueAtTime(340, now);
    pop.frequency.exponentialRampToValueAtTime(80, now + 0.06);
    popGain.gain.setValueAtTime(0.2, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    pop.connect(popGain);
    popGain.connect(this.ctx.destination);
    pop.start(now);
    pop.stop(now + 0.08);
  }

  /**
   * M4 Assault Rifle (deep military crack)
   */
  public playM4(): void {
    if (!this.ctx || !this.skidBuffer) return;
    this.resume();
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.skidBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.18);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Rocket Launch (screeching thruster whoosh)
   */
  public playRocketLaunch(): void {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  /**
   * Massive Vice City Explosion Blast
   */
  public playExplosion(): void {
    if (!this.ctx || !this.skidBuffer) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Sub-bass detonation thump
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.85);
    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.95);

    // Roaring noise explosion
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.skidBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.75);
  }

  /**
   * Rhino Tank Cannon shot
   */
  public playTankCannon(): void {
    this.playExplosion();
  }

  /**
   * Iconic Vice City "Cheat Activated" Chime
   */
  public playCheatActivated(): void {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Major arpeggio)
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  /**
   * Vice City 80s Synthwave Radio
   */
  public getRadioStation(): string {
    return this.radioStations[this.currentRadioStation];
  }

  public nextRadioStation(): string {
    this.currentRadioStation = (this.currentRadioStation + 1) % this.radioStations.length;
    this.restartRadio();
    return this.getRadioStation();
  }

  public prevRadioStation(): string {
    this.currentRadioStation = (this.currentRadioStation - 1 + this.radioStations.length) % this.radioStations.length;
    this.restartRadio();
    return this.getRadioStation();
  }

  private restartRadio(): void {
    if (this.radioInterval) {
      clearInterval(this.radioInterval);
      this.radioInterval = null;
    }
    if (this.currentRadioStation !== 5) {
      this.startRadio();
    }
  }

  private startRadio(): void {
    if (!this.ctx || this.currentRadioStation === 5) return;

    // 1. Flash FM: F - G - Em - Am
    // 2. Wave 103: Dm - Bb - C - Am
    // 3. Fever 105: Em7 - A7 - Dmaj7 - Bm7
    // 4. V-Rock: E5 - G5 - A5 - D5 (Heavy metal power chords)
    // 5. Emotion 98.3: Cmaj7 - Am7 - Dm7 - G7 (Dreamy Crockett's Theme)
    const chordsFlashFM = [
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
      [164.81, 196.0, 246.94],
      [220.0, 261.63, 329.63],
    ];

    const chordsWave103 = [
      [146.83, 174.61, 220.0],
      [116.54, 146.83, 174.61],
      [130.81, 164.81, 196.0],
      [110.0, 130.81, 164.81],
    ];

    const chordsFever105 = [
      [164.81, 196.0, 246.94, 293.66],
      [220.0, 277.18, 329.63, 392.0],
      [146.83, 185.0, 220.0, 277.18],
      [123.47, 146.83, 185.0, 220.0],
    ];

    const chordsVRock = [
      [82.41, 123.47, 164.81], // E5 power chord
      [98.0, 146.83, 196.0],   // G5
      [110.0, 164.81, 220.0],  // A5
      [73.42, 110.0, 146.83],  // D5
    ];

    const chordsEmotion = [
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [110.0, 130.81, 164.81, 196.0],  // Am7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [98.0, 123.47, 146.83, 174.61],  // G7
    ];

    let chordSet = chordsFlashFM;
    if (this.currentRadioStation === 1) chordSet = chordsWave103;
    if (this.currentRadioStation === 2) chordSet = chordsFever105;
    if (this.currentRadioStation === 3) chordSet = chordsVRock;
    if (this.currentRadioStation === 4) chordSet = chordsEmotion;

    let step = 0;
    const intervalMs = this.currentRadioStation === 3 ? 320 : (this.currentRadioStation === 4 ? 480 : 380);

    this.radioInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state === 'suspended' || this.currentRadioStation === 5) return;
      const now = this.ctx.currentTime;
      const chord = chordSet[step % chordSet.length];

      chord.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        if (this.currentRadioStation === 3) {
          // V-Rock: Sawtooth overdrive guitar
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.026, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

          const filter = this.ctx!.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2400, now);
          osc.connect(filter);
          filter.connect(gain);
        } else if (this.currentRadioStation === 4) {
          // Emotion 98.3: Dreamy Jan Hammer synth
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * 1.5, now);
          gain.gain.setValueAtTime(0.022, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.connect(gain);
        } else {
          osc.type = this.currentRadioStation === 1 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(freq * (this.currentRadioStation === 1 ? 1 : 1.5), now);
          gain.gain.setValueAtTime(0.018, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

          const filter = this.ctx!.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1400, now);
          osc.connect(filter);
          filter.connect(gain);
        }

        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + 0.85);
      });

      // Gated Snare / Rock Snare
      if (step % 2 === 1 && this.skidBuffer) {
        const snareNoise = this.ctx.createBufferSource();
        snareNoise.buffer = this.skidBuffer;
        const snareGain = this.ctx.createGain();
        snareGain.gain.setValueAtTime(this.currentRadioStation === 3 ? 0.1 : 0.07, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(this.currentRadioStation === 3 ? 2400 : 1800, now);

        snareNoise.connect(filter);
        filter.connect(snareGain);
        snareGain.connect(this.ctx.destination);
        snareNoise.start(now);
        snareNoise.stop(now + 0.22);
      }

      // Kick Drum
      if (step % 2 === 0 || (this.currentRadioStation === 3 && step % 4 === 3)) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(130, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
        kickGain.gain.setValueAtTime(0.12, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.18);
      }

      step++;
    }, intervalMs);
  }
}
