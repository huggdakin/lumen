// Звуковой движок LUMEN: тёплый бесшовный космический пэд и мягкие музыкальные SFX на WebAudio.
// Все частоты фонового пэда строго кратны 1/DUR Гц — математически идеальная петля без обрывов и щелчков.

const PAD_SCALE = [110.0, 164.81, 220.0, 246.94, 261.63, 329.63, 392.0]; // Am9 / Cmaj7
const PICKUP_SCALE = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1046.5, 1174.66, 1318.51];

function createSeamlessPadBuffer(ctx: AudioContext): AudioBuffer {
  const sr = 24000;
  const dur = 16; // 16 секунд — плавное дыхание без ощущения короткой зацикленности
  const len = sr * dur;
  const buf = ctx.createBuffer(2, len, sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  // Округляем каждую частоту до целого числа периодов на длине dur: фаза в конце === фазе в начале
  const snap = (f: number) => Math.round(f * dur) / dur;
  const freqs = PAD_SCALE.map(snap);
  const amps = [0.24, 0.2, 0.18, 0.09, 0.12, 0.09, 0.06];
  const lfoRates = [1 / dur, 2 / dur, 1 / dur, 3 / dur, 2 / dur, 1 / dur, 2 / dur];

  const twoPi = Math.PI * 2;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let sL = 0;
    let sR = 0;
    for (let k = 0; k < freqs.length; k++) {
      const f = freqs[k];
      const lfoL = 0.72 + 0.28 * Math.sin(twoPi * lfoRates[k] * t + k * 1.1);
      const lfoR = 0.72 + 0.28 * Math.sin(twoPi * lfoRates[k] * t + k * 1.1 + 0.9);
      const ph = twoPi * f * t;
      sL += amps[k] * lfoL * Math.sin(ph + k * 0.4);
      sR += amps[k] * lfoR * Math.sin(ph + k * 0.4 + (k % 2 === 0 ? 0.18 : -0.18));
    }
    left[i] = sL * 0.48;
    right[i] = sR * 0.48;
  }
  return buf;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private sfxFilter: BiquadFilterNode | null = null;

  private padBuffer: AudioBuffer | null = null;
  private padSource: AudioBufferSourceNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;

  private musicVol = 0.08;
  private _muted = false;
  private droneActive = false;
  private unlockedOnce = false;
  private lastPulseAt = 0;
  private noiseBuf: AudioBuffer | null = null;

  get muted() {
    return this._muted;
  }

  private ensure() {
    if (this.ctx && this.ctx.state !== 'closed') return;
    try {
      // На iOS Safari 17+ переводим аудиосессию в режим playback (играет даже с рычажком беззвучного режима)
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';

      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.72;
      this.master.connect(ctx.destination);

      // Мягкий lowpass на шине SFX убирает резкие цифровые призвуки на любых динамиках
      this.sfxFilter = ctx.createBiquadFilter();
      this.sfxFilter.type = 'lowpass';
      this.sfxFilter.frequency.value = 5200;
      this.sfxFilter.Q.value = 0.5;

      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.58;
      this.sfx.connect(this.sfxFilter);
      this.sfxFilter.connect(this.master);

      // Предварительно создаём буфер мягкого шума (без аллокаций во время забега)
      const nLen = Math.floor(ctx.sampleRate * 0.6);
      const nb = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const ch = nb.getChannelData(0);
      for (let i = 0; i < nLen; i++) ch[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
    } catch {
      this.ctx = null;
    }
  }

  private targetPadGain(): number {
    if (this._muted || !this.droneActive || this.musicVol <= 0.001) return 0;
    return Math.min(0.32, this.musicVol * 2.1);
  }

  /** Вызывать из пользовательского жеста — разблокирует WebAudio на мобильных, НЕ включая дрон вне забега. */
  resume() {
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (!this.unlockedOnce && this.master) {
      this.unlockedOnce = true;
      try {
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.master);
        src.start();
      } catch {
        /* ignore */
      }
    }
    if (this.droneActive && !this.padSource) {
      this.ensurePadRunning();
    }
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.72, t, 0.04);
    if (this.padGain) {
      this.padGain.gain.cancelScheduledValues(t);
      this.padGain.gain.setTargetAtTime(this.targetPadGain(), t, 0.12);
    }
  }

  setMusicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(0.4, v));
    if (!this.ctx || !this.padGain) return;
    const t = this.ctx.currentTime;
    this.padGain.gain.cancelScheduledValues(t);
    this.padGain.gain.setTargetAtTime(this.targetPadGain(), t, 0.18);
  }

  // ---------------- Мягкий синтез SFX без щелчков ----------------

  private bell(
    freq: number,
    dur: number,
    vol: number,
    opts?: { type?: OscillatorType; slideTo?: number; delay?: number; shimmer?: number; attack?: number }
  ) {
    if (!this.ctx || !this.sfx || this._muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts?.delay ?? 0);
    const attack = opts?.attack ?? 0.012;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = opts?.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(24, freq), t);
    if (opts?.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.slideTo), t + dur * 0.88);
    }

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g);
    g.connect(this.sfx);

    let osc2: OscillatorNode | null = null;
    let g2: GainNode | null = null;
    if (opts?.shimmer) {
      osc2 = ctx.createOscillator();
      g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(Math.min(8000, freq * 2), t);
      if (opts.slideTo) {
        osc2.frequency.exponentialRampToValueAtTime(Math.min(8000, opts.slideTo * 2), t + dur * 0.75);
      }
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(vol * opts.shimmer, t + attack);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
      osc2.connect(g2);
      g2.connect(this.sfx);
      osc2.start(t);
      osc2.stop(t + dur + 0.04);
    }

    osc.onended = () => {
      g.disconnect();
      g2?.disconnect();
    };
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  private airBurst(dur: number, vol: number, freqStart: number, freqEnd: number, q = 1.4, delay = 0) {
    if (!this.ctx || !this.sfx || !this.noiseBuf || this._muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = q;
    flt.frequency.setValueAtTime(Math.max(60, freqStart), t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(60, freqEnd), t + dur * 0.85);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.035, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(flt);
    flt.connect(g);
    g.connect(this.sfx);
    src.onended = () => {
      flt.disconnect();
      g.disconnect();
    };
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  pickup(combo: number, max = false) {
    this.ensure();
    const idx = Math.max(0, Math.min(PICKUP_SCALE.length - 1, combo - 1));
    const note = PICKUP_SCALE[idx];
    this.bell(note, 0.22, 0.16, { shimmer: 0.24, attack: 0.008 });
    if (max) {
      this.bell(note * 1.25, 0.28, 0.08, { delay: 0.045, attack: 0.01 });
    }
  }

  nearMiss() {
    this.ensure();
    this.airBurst(0.26, 0.09, 520, 2200, 1.8);
    this.bell(1046.5, 0.18, 0.065, { slideTo: 1318.51, delay: 0.06, attack: 0.01 });
  }

  hit() {
    this.ensure();
    // Мягкий глубокий толчок без резкого высокочастотного треска
    this.bell(118, 0.28, 0.24, { type: 'triangle', slideTo: 44, attack: 0.006 });
    this.bell(68, 0.36, 0.2, { type: 'sine', slideTo: 34, delay: 0.01, attack: 0.01 });
    this.airBurst(0.18, 0.09, 340, 120, 0.9);
  }

  powerup() {
    this.ensure();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.bell(f, 0.28, 0.12, { shimmer: 0.2, delay: i * 0.055, attack: 0.01 })
    );
  }

  flash() {
    this.ensure();
    this.airBurst(0.38, 0.1, 1800, 620, 1.2);
    this.bell(880, 0.36, 0.11, { slideTo: 440, shimmer: 0.25, attack: 0.01 });
    this.bell(1318.5, 0.3, 0.08, { delay: 0.04, attack: 0.012 });
  }

  flow() {
    this.ensure();
    [440, 523.25, 659.25, 880, 1046.5].forEach((f, i) =>
      this.bell(f, 0.34, 0.11, { type: 'sine', shimmer: 0.22, delay: i * 0.055, attack: 0.012 })
    );
  }

  gameOver() {
    this.ensure();
    // Спокойный затухающий аккорд угасания искры (без тяжёлого гула)
    this.bell(329.63, 0.75, 0.12, { slideTo: 311.13, delay: 0.0, attack: 0.025 });
    this.bell(246.94, 0.85, 0.11, { delay: 0.14, attack: 0.03 });
    this.bell(220.0, 1.05, 0.13, { delay: 0.28, attack: 0.035 });
    this.bell(110.0, 1.15, 0.11, { delay: 0.28, attack: 0.04 });
  }

  click() {
    this.ensure();
    this.bell(587.33, 0.075, 0.075, { slideTo: 783.99, attack: 0.005 });
  }

  hover() {
    this.ensure();
    this.bell(987.77, 0.045, 0.022, { attack: 0.005 });
  }

  buy() {
    this.ensure();
    [523.25, 659.25, 987.77, 1318.51].forEach((f, i) =>
      this.bell(f, 0.24, 0.11, { shimmer: 0.2, delay: i * 0.06, attack: 0.008 })
    );
  }

  deny() {
    this.ensure();
    this.bell(246.94, 0.16, 0.08, { type: 'triangle', slideTo: 196.0, attack: 0.008 });
  }

  mission() {
    this.ensure();
    [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((f, i) =>
      this.bell(f, 0.34, 0.11, { shimmer: 0.18, delay: i * 0.075, attack: 0.012 })
    );
  }

  chest(good: boolean) {
    this.ensure();
    const notes = good ? [523.25, 659.25, 783.99, 987.77, 1318.51] : [392.0, 523.25, 659.25];
    notes.forEach((f, i) => this.bell(f, 0.32, 0.11, { shimmer: 0.2, delay: i * 0.07, attack: 0.01 }));
  }

  charge() {
    this.ensure();
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) =>
      this.bell(f, 0.22, 0.11, { shimmer: 0.2, delay: i * 0.045, attack: 0.008 })
    );
  }

  // ---------------- Атмосферный бесшовный пэд (строго во время забега) ----------------

  private ensurePadRunning() {
    if (!this.ctx || !this.master || this.padSource) return;
    const ctx = this.ctx;
    if (!this.padBuffer) {
      this.padBuffer = createSeamlessPadBuffer(ctx);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);

    const src = ctx.createBufferSource();
    src.buffer = this.padBuffer;
    src.loop = true;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();

    this.padSource = src;
    this.padFilter = filter;
    this.padGain = gain;
  }

  startDrone() {
    this.ensure();
    this.droneActive = true;
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.ensurePadRunning();
    if (this.padGain) {
      const t = this.ctx.currentTime;
      this.padGain.gain.cancelScheduledValues(t);
      this.padGain.gain.setTargetAtTime(this.targetPadGain(), t, 0.45);
    }
    this.lastPulseAt = this.ctx.currentTime;
  }

  /** v — прогресс скорости 0..1, danger — нехватка света 0..1. */
  setIntensity(v: number, danger: number) {
    if (!this.droneActive || !this.ctx) return;
    const t = this.ctx.currentTime;

    if (this.padFilter) {
      // На скорости пэд мягко раскрывается по тембру, в густой темноте — приглушается
      const cutoff = (620 + v * 520) * (1 - danger * 0.35);
      this.padFilter.frequency.setTargetAtTime(Math.max(280, cutoff), t, 0.25);
    }

    // Деликатный мягкий пульс «сердца» только при критической нехватке света (< 26%)
    if (danger > 0.74 && !this._muted) {
      const interval = Math.max(0.68, 1.08 - (danger - 0.74) * 1.1);
      if (t - this.lastPulseAt >= interval) {
        this.lastPulseAt = t;
        const vol = 0.035 + (danger - 0.74) * 0.14;
        this.bell(66, 0.22, vol, { type: 'sine', slideTo: 44, attack: 0.025 });
        this.bell(58, 0.24, vol * 0.65, { type: 'sine', slideTo: 40, delay: 0.19, attack: 0.03 });
      }
    }
  }

  stopDrone() {
    this.droneActive = false;
    if (!this.ctx || !this.padGain) return;
    const t = this.ctx.currentTime;
    this.padGain.gain.cancelScheduledValues(t);
    this.padGain.gain.setTargetAtTime(0, t, 0.14);
  }

  dispose() {
    this.stopDrone();
    try {
      this.padSource?.stop();
      this.padSource?.disconnect();
    } catch {
      /* ignore */
    }
    this.padSource = null;
    this.padFilter = null;
    this.padGain = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
