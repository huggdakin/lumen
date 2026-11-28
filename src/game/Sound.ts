// Звуковой движок LUMEN: генеративная музыка (меню — глубокий спокойный пэд, забег — мягкая
// мелодия с арпеджио) и тёплые SFX на WebAudio. Всё синтезируется на лету, без файлов.

// Мягкий «бархатный» сбор светлячков: пентатоника Am в низко-средней октаве (без звона)
const PICKUP_SCALE = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

const NOTE_IDX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'F#4' → частота, Гц. */
function nf(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) return 440;
  const semi = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = 12 * (Number(m[3]) + 1) + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------- Меню: Dm9 – Bbmaj7 – Fmaj9 – C(add9), по 9.6 с ----------
const MENU_CHORD_DUR = 9.6;
const MENU_CHORDS = [
  { bass: 'D2', pad: ['D3', 'A3', 'C4', 'E4', 'F4'], spark: ['A4', 'D5', 'E5', 'F5', 'A5'] },
  { bass: 'Bb1', pad: ['Bb2', 'F3', 'A3', 'D4', 'F4'], spark: ['F4', 'A4', 'D5', 'F5', 'C5'] },
  { bass: 'F2', pad: ['F3', 'A3', 'C4', 'E4', 'G4'], spark: ['C5', 'E5', 'G5', 'A4', 'A5'] },
  { bass: 'C2', pad: ['C3', 'G3', 'C4', 'D4', 'E4'], spark: ['G4', 'D5', 'E5', 'G5', 'C5'] },
].map((c) => ({ bass: nf(c.bass), pad: c.pad.map(nf), spark: c.spark.map(nf) }));

// ---------- Забег: Am – Fmaj7 – C – G6/9, 96 bpm, восьмые ----------
const GAME_STEP = 60 / 96 / 2;
const GAME_CHORDS = [
  { bass: 'A1', pad: ['A2', 'E3', 'A3', 'C4'], arp: ['A3', 'C4', 'E4', 'G4', 'B4'], mel: ['E5', null, 'C5', null, 'D5', 'E5', null, 'C5'] },
  { bass: 'F2', pad: ['F2', 'C3', 'A3', 'E4'], arp: ['F3', 'A3', 'C4', 'E4', 'G4'], mel: ['A4', null, 'C5', null, 'F5', 'E5', null, 'C5'] },
  { bass: 'C2', pad: ['C3', 'G3', 'E4', 'B3'], arp: ['C4', 'E4', 'G4', 'B4', 'D5'], mel: ['G4', null, 'C5', null, 'E5', 'D5', null, 'C5'] },
  { bass: 'G1', pad: ['G2', 'D3', 'B3', 'E4'], arp: ['G3', 'B3', 'D4', 'E4', 'A4'], mel: ['D5', null, 'B4', null, 'D5', 'E5', null, 'A4'] },
].map((c) => ({
  bass: nf(c.bass),
  pad: c.pad.map(nf),
  arp: c.arp.map(nf),
  mel: c.mel.map((x) => (x ? nf(x) : null)),
}));
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 4];

/** Синтетическая импульсная характеристика «большого зала»: затухающий шум, смягчённый фильтром. */
function createReverbIR(ctx: AudioContext): AudioBuffer {
  const isTouch =
    typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
  const seconds = isTouch ? 2.0 : 3.2;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 2.6);
      lp += ((Math.random() * 2 - 1) - lp) * 0.32; // убираем «шипение»
      d[i] = lp * env * 0.9;
    }
  }
  return buf;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private sfxFilter: BiquadFilterNode | null = null;

  // музыкальная шина: меню / забег — отдельные ветки с кроссфейдом, общий «зал» (реверб)
  private musicBus: GainNode | null = null;
  private menuBus: GainNode | null = null;
  private gameBus: GainNode | null = null;
  private padIn: GainNode | null = null; // пэды забега
  private pluckFilter: BiquadFilterNode | null = null;
  private pluckIn: GainNode | null = null;
  private musicMode: 'menu' | 'game' = 'menu';
  private musicTimer: number | null = null;
  private musicT0 = 0;
  private chordN = 0; // меню: сколько аккордов уже запланировано
  private stepN = 0; // забег: сколько шагов запланировано
  private sparkN = 0; // меню: сколько искорок запланировано

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

      this.buildMusicGraph(ctx);
    } catch {
      this.ctx = null;
    }
  }

  private musicLevel(): number {
    if (this._muted || this.musicVol <= 0.001) return 0;
    return Math.min(0.55, this.musicVol * 3.2);
  }

  /** Вызывать из пользовательского жеста — разблокирует WebAudio на мобильных и запускает музыку текущего режима. */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resume() {
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') {
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
    this.startMusicLoop();
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.72, t, 0.04);
    this.applyMusicLevel(0.12);
  }

  setMusicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(0.4, v));
    this.applyMusicLevel(0.18);
  }

  private applyMusicLevel(tc: number) {
    if (!this.ctx || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(this.musicLevel(), t, tc);
  }

  // ---------------- Мягкий синтез SFX без щелчков ----------------

  private bell(
    freq: number,
    dur: number,
    vol: number,
    opts?: { type?: OscillatorType; slideTo?: number; delay?: number; shimmer?: number; attack?: number }
  ) {
    if (!this.ctx || !this.sfx || this._muted || this.ctx.state !== 'running') return;
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
    if (!this.ctx || !this.sfx || !this.noiseBuf || this._muted || this.ctx.state !== 'running') return;
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

  /** Тёплая нота без металлического звона: мягкое «тело» + короткий басовый толчок. */
  private soft(
    freq: number,
    dur: number,
    vol: number,
    opts?: { from?: number; cutoff?: number; type?: OscillatorType; delay?: number; attack?: number }
  ) {
    if (!this.ctx || !this.sfx || this._muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts?.delay ?? 0);
    const attack = opts?.attack ?? 0.008;
    const osc = ctx.createOscillator();
    osc.type = opts?.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(24, freq * (opts?.from ?? 1)), t);
    if (opts?.from) osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq), t + Math.min(0.07, dur * 0.4));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts?.cutoff ?? 1400;
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    osc.onended = () => {
      g.disconnect();
      lp.disconnect();
    };
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  pickup(combo: number, max = false) {
    this.ensure();
    const idx = Math.max(0, Math.min(PICKUP_SCALE.length - 1, combo - 1));
    const note = PICKUP_SCALE[idx];
    // тело ноты — круглое, без «звона»
    this.soft(note, 0.24, 0.2, { from: 1.05, cutoff: 1300 });
    this.soft(note * 2, 0.12, 0.035, { type: 'triangle', cutoff: 1500 });
    // небольшой бас под нотой
    this.soft(98, 0.2, 0.17, { from: 1.5, cutoff: 420, attack: 0.006 });
    if (max) this.soft(note * 1.5, 0.3, 0.08, { delay: 0.05, cutoff: 1300, attack: 0.012 });
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

  /** Щит: глубокий «купол» и чистый восходящий аккорд. */
  shield() {
    this.ensure();
    this.bell(196, 0.4, 0.16, { type: 'triangle', slideTo: 392, attack: 0.01 });
    [392, 587.33, 783.99].forEach((f, i) =>
      this.bell(f, 0.34, 0.1, { shimmer: 0.25, delay: 0.05 + i * 0.07, attack: 0.012 })
    );
  }

  /**
   * Щит принял удар и рассыпался: глухой толчок поглощённого удара, стеклянный треск,
   * каскад осколков-звоночков вниз по гамме и тёплая «выдохнувшая» нота — «пронесло».
   * Уникален: не похож ни на hit(), ни на shield() (подбор щита).
   */
  shieldBreak() {
    this.ensure();
    // поглощённый удар
    this.bell(150, 0.26, 0.2, { type: 'triangle', slideTo: 58, attack: 0.004 });
    this.airBurst(0.08, 0.15, 5600, 2400, 2.4);
    // стеклянный треск и россыпь
    this.airBurst(0.26, 0.06, 7200, 2800, 1.1, 0.025);
    [2349.3, 1975.5, 1760, 1480, 1318.5, 1108.7, 987.8, 783.99].forEach((f, i) =>
      this.bell(f, 0.2 + i * 0.012, 0.055 - i * 0.003, { shimmer: 0.4, delay: 0.03 + i * 0.042 + (i % 2) * 0.012, attack: 0.002 })
    );
    // щит «сдувается»: нисходящий свист
    this.bell(920, 0.46, 0.085, { type: 'sine', slideTo: 210, delay: 0.04, attack: 0.01 });
    // тёплая нота облегчения
    this.soft(196, 0.55, 0.1, { delay: 0.16, cutoff: 900 });
    this.soft(293.66, 0.5, 0.06, { delay: 0.2, cutoff: 1100 });
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
    this.soft(520, 0.1, 0.05, { from: 0.9, cutoff: 1800, attack: 0.006 });
    this.soft(260, 0.09, 0.03, { cutoff: 600, attack: 0.006 });
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

  // ---------------- Генеративная музыка ----------------

  private buildMusicGraph(ctx: AudioContext) {
    const musicBus = ctx.createGain();
    musicBus.gain.value = this.musicLevel();
    musicBus.connect(this.master!);
    this.musicBus = musicBus;

    // общий «зал»
    const conv = ctx.createConvolver();
    conv.buffer = createReverbIR(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.85;
    conv.connect(wet);
    wet.connect(musicBus);
    const reverbIn = ctx.createGain();
    reverbIn.connect(conv);

    const mkBranch = (send: number) => {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(musicBus);
      const sg = ctx.createGain();
      sg.gain.value = send;
      bus.connect(sg);
      sg.connect(reverbIn);
      return bus;
    };
    this.menuBus = mkBranch(0.75);
    this.gameBus = mkBranch(0.5);

    // пэды забега (мягко приглушены)
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 760;
    padLp.Q.value = 0.4;
    const padIn = ctx.createGain();
    padIn.connect(padLp);
    padLp.connect(this.gameBus);
    this.padIn = padIn;

    // щипки забега: фильтр + эхо «пунктиром»
    const pluckIn = ctx.createGain();
    const pluckFilter = ctx.createBiquadFilter();
    pluckFilter.type = 'lowpass';
    pluckFilter.frequency.value = 1700;
    pluckFilter.Q.value = 0.5;
    pluckIn.connect(pluckFilter);
    pluckFilter.connect(this.gameBus);
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = GAME_STEP * 3; // восьмая с точкой
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const dLp = ctx.createBiquadFilter();
    dLp.type = 'lowpass';
    dLp.frequency.value = 1500;
    pluckFilter.connect(delay);
    delay.connect(dLp);
    dLp.connect(fb);
    fb.connect(delay);
    const dOut = ctx.createGain();
    dOut.gain.value = 0.55;
    dLp.connect(dOut);
    dOut.connect(this.gameBus);
    this.pluckIn = pluckIn;
    this.pluckFilter = pluckFilter;
  }

  private startMusicLoop() {
    if (this.musicTimer !== null || !this.ctx) return;
    this.setMusicMode(this.musicMode, true);
    this.musicTimer = window.setInterval(() => this.musicTick(), 180);
    this.musicTick();
  }

  private setMusicMode(mode: 'menu' | 'game', force = false) {
    const ctx = this.ctx;
    if (!ctx || !this.menuBus || !this.gameBus) {
      this.musicMode = mode;
      return;
    }
    if (mode === this.musicMode && !force) return;
    this.musicMode = mode;
    const t = ctx.currentTime;
    this.menuBus.gain.cancelScheduledValues(t);
    this.gameBus.gain.cancelScheduledValues(t);
    this.menuBus.gain.setTargetAtTime(mode === 'menu' ? 1 : 0, t, mode === 'menu' ? 1.1 : 0.35);
    this.gameBus.gain.setTargetAtTime(mode === 'game' ? 1 : 0, t, mode === 'game' ? 0.7 : 0.35);
    this.musicT0 = t + 0.12;
    this.chordN = 0;
    this.stepN = 0;
    this.sparkN = 0;
  }

  private musicTick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this._muted || this.musicVol <= 0.001) return;
    const now = ctx.currentTime;
    const horizon = now + 1.1;

    if (this.musicMode === 'menu') {
      // если планировщик заснул (вкладка в фоне) — начинаем заново, не догоняя пропущенное
      if (this.musicT0 + this.chordN * MENU_CHORD_DUR < now - 1) {
        this.musicT0 = now + 0.1;
        this.chordN = 0;
        this.sparkN = 0;
      }
      while (this.musicT0 + this.chordN * MENU_CHORD_DUR < horizon) {
        this.playMenuChord(this.musicT0 + this.chordN * MENU_CHORD_DUR, MENU_CHORDS[this.chordN % MENU_CHORDS.length]);
        this.chordN++;
      }
      const SPARK = 1.6;
      while (this.musicT0 + this.sparkN * SPARK < horizon) {
        const t = this.musicT0 + this.sparkN * SPARK;
        const ci = Math.floor(this.sparkN * SPARK / MENU_CHORD_DUR) % MENU_CHORDS.length;
        // редкие, почти случайные «капли» света из тонов аккорда
        if (this.sparkN % 2 === 0 || Math.random() < 0.35) {
          const ch = MENU_CHORDS[ci];
          const f = ch.spark[(this.sparkN * 3 + Math.floor(Math.random() * 2)) % ch.spark.length];
          this.musicPluck(f, t, 2.6, 0.05, 'menu');
        }
        this.sparkN++;
      }
    } else {
      if (this.musicT0 + this.stepN * GAME_STEP < now - 1) {
        this.musicT0 = now + 0.1;
        this.stepN = 0;
      }
      while (this.musicT0 + this.stepN * GAME_STEP < horizon) {
        this.playGameStep(this.musicT0 + this.stepN * GAME_STEP, this.stepN);
        this.stepN++;
      }
    }
  }

  /** Мягкий голос пэда: две слегка расстроенные волны, медленная атака и долгий выход. */
  private padVoice(dest: AudioNode, f: number, t: number, dur: number, vol: number, attack: number, release: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    g.connect(dest);
    const end = t + dur + release + 0.05;
    const mk = (type: OscillatorType, detune: number, k: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      const og = ctx.createGain();
      og.gain.value = k;
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(end);
      o.onended = () => {
        og.disconnect();
        if (type === 'sine' && detune < 0) g.disconnect();
      };
    };
    mk('sine', -6, 0.6);
    mk('triangle', 6, 0.4);
  }

  /** Тёплая мягкая нота (щипок/колокольчик без резкой атаки). */
  private musicPluck(f: number, t: number, dur: number, vol: number, where: 'menu' | 'game') {
    const ctx = this.ctx;
    if (!ctx) return;
    const dest = where === 'menu' ? this.menuBus : this.pluckIn;
    if (!dest) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(dest);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    o.onended = () => {
      g.disconnect();
      g2.disconnect();
    };
  }

  private musicBass(f: number, t: number, dur: number, vol: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    o.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(dest);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    o.onended = () => {
      g.disconnect();
      lp.disconnect();
      g2.disconnect();
    };
  }

  /** Меню: глубокий медленный аккорд + бас. */
  private playMenuChord(t: number, ch: (typeof MENU_CHORDS)[number]) {
    if (!this.menuBus || !this.ctx) return;
    if (!this.menuLp) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      lp.Q.value = 0.35;
      // медленное «дыхание» тембра
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.06;
      const lg = this.ctx.createGain();
      lg.gain.value = 260;
      lfo.connect(lg);
      lg.connect(lp.frequency);
      lfo.start();
      lp.connect(this.menuBus);
      this.menuLp = lp;
    }
    for (const f of ch.pad) this.padVoice(this.menuLp, f, t, MENU_CHORD_DUR, 0.045, 2.6, 3.2);
    this.musicBass(ch.bass, t, MENU_CHORD_DUR + 1.2, 0.2, this.menuBus);
    // чуть позже — высокий тихий «воздух» над аккордом
    this.padVoice(this.menuLp, ch.pad[ch.pad.length - 1] * 2, t + 1.2, MENU_CHORD_DUR - 2, 0.016, 3, 3);
  }

  /** Забег: пэд на два такта, бас, арпеджио восьмыми и мелодия по четвертям. */
  private playGameStep(t: number, n: number) {
    if (!this.padIn || !this.gameBus) return;
    const ci = Math.floor(n / 16) % GAME_CHORDS.length;
    const s = n % 16;
    const ch = GAME_CHORDS[ci];
    if (s === 0) {
      for (const f of ch.pad) this.padVoice(this.padIn, f, t, GAME_STEP * 16, 0.04, 0.9, 1.6);
    }
    if (s % 8 === 0) this.musicBass(ch.bass, t, GAME_STEP * 5, 0.2, this.gameBus);
    else if (s % 8 === 6) this.musicBass(ch.bass * (s === 6 ? 1 : 1.5), t, GAME_STEP * 1.6, 0.12, this.gameBus);
    // арпеджио
    const ai = ARP_PATTERN[s % 8];
    this.musicPluck(ch.arp[ai], t, 0.9, s % 2 === 0 ? 0.036 : 0.024, 'game');
    // мелодия (каждая четверть)
    if (s % 2 === 0) {
      const m = ch.mel[s / 2];
      if (m) this.musicPluck(m, t, 1.5, 0.058, 'game');
    }
  }

  private menuLp: BiquadFilterNode | null = null;

  startDrone() {
    this.ensure();
    this.droneActive = true;
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
    this.setMusicMode('game');
    this.startMusicLoop();
    this.lastPulseAt = this.ctx.currentTime;
  }

  /** v — прогресс скорости 0..1, danger — нехватка света 0..1. */
  setIntensity(v: number, danger: number) {
    if (!this.droneActive || !this.ctx) return;
    const t = this.ctx.currentTime;

    if (this.pluckFilter) {
      // На скорости мелодия мягко раскрывается по тембру, в густой темноте — приглушается
      const cutoff = (1500 + v * 1500) * (1 - danger * 0.45);
      this.pluckFilter.frequency.setTargetAtTime(Math.max(600, cutoff), t, 0.3);
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

  /** Останавливает музыку забега — возвращается спокойная музыка меню. */
  stopDrone() {
    this.droneActive = false;
    this.setMusicMode('menu');
  }

  dispose() {
    this.droneActive = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.menuLp = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
