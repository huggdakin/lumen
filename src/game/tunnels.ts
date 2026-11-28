// Линейка тоннелей LUMEN: «образ» (look) каждого тоннеля, процедурные текстуры стен,
// наборы рёбер и превью для магазина. Всё строится один раз и переиспользуется.
import * as THREE from 'three';
import type { Theme } from './economy';

export interface WallPalette {
  a: string;
  b: string;
  c: string;
  seam: string;
  cool: string;
  warm: string;
  dark: string;
  glass: string;
}

export type PanelKind = 'pulse' | 'copper' | 'polar' | 'lemon' | 'prism' | 'magma' | 'crystal' | 'zero';
export type RibShape = 'round';

export interface TunnelLook {
  panel: PanelKind;
  /**
   * Ритм рёбер, период 16 колец (по 8 м): G — большое ребро, M — среднее, m — тонкое,
   * i — внутреннее малое кольцо, s — сегментное кольцо, x — пусто.
   * Просторный шаг (через 2–4 секции) даёт ощущение воздуха и чистой перспективы.
   */
  ribPattern: string;
  ribShape: RibShape;
  ribColors: { body: number; edge: number; accent: number; dim: number };
  halo: number; // мягкое свечение вокруг больших рёбер (0..0.2)
  hueSway?: { from: number; to: number; speed: number; sat?: number; light?: number }; // плавное дыхание оттенка кромки (HSL hue 0..1)
  beams: { count: number; width: number };
  ambient: { color: number; intensity: number };
  playerLight: number; // множитель света искры
  fog: number; // базовая плотность тумана
  core: { color: number; size: number; opacity: number; rays: number; ring: number };
  dust: { n: number; size: number; opacity: number; colors: number[] };
  streak: { color: number; gain: number };
  windows: number; // доля панелей-иллюминаторов
}

export const TUNNEL_LOOKS: Record<string, TunnelLook> = {
  // 1. Холодный импульс (Бесплатный) — полупрозрачная ячеистая обшивка, статичные ориентиры без визуального шума
  pulse: {
    panel: 'pulse',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x0c1933, edge: 0x5ec8ff, accent: 0x2e6bd9, dim: 0x22437a },
    halo: 0.016,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0x8eaaf2, intensity: 1.24 },
    playerLight: 1.16,
    fog: 0.0074,
    core: { color: 0x64c4ff, size: 7.5, opacity: 0.1, rays: 0, ring: 0 },
    dust: { n: 8, size: 0.045, opacity: 0.1, colors: [0xb8e2ff] },
    streak: { color: 0x6ec8ff, gain: 0.16 },
    windows: 0,
  },
  // 2. Медные кольца (Бесплатный) — полупрозрачный бронзовый каркас, спокойные продольные фаски
  copper: {
    panel: 'copper',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x1c120d, edge: 0xf09a36, accent: 0xd97b24, dim: 0x5c3718 },
    halo: 0.014,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0xffd09c, intensity: 1.22 },
    playerLight: 1.16,
    fog: 0.0076,
    core: { color: 0xf09a36, size: 7.5, opacity: 0.09, rays: 0, ring: 0 },
    dust: { n: 8, size: 0.045, opacity: 0.1, colors: [0xffc478, 0xffe2b8] },
    streak: { color: 0xf09a36, gain: 0.15 },
    windows: 0,
  },
  // 3. Полярная глубина (Бесплатный) — полупрозрачный бирюзовый свод с чёткой пространственной сеткой
  polar: {
    panel: 'polar',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x082630, edge: 0x4de6cf, accent: 0x2da8b8, dim: 0x185866 },
    halo: 0.018,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0x86e5f0, intensity: 1.24 },
    playerLight: 1.14,
    fog: 0.0075,
    core: { color: 0x4de6cf, size: 7.5, opacity: 0.1, rays: 0, ring: 0 },
    dust: { n: 10, size: 0.048, opacity: 0.12, colors: [0x9effeb, 0x80c8ff] },
    streak: { color: 0x66f0dc, gain: 0.15 },
    windows: 0,
  },
  // 4. Лимонный свет (Платный, 900✦) — лаконичный графитовый свод без лишних линий и мягкие золотистые ориентиры
  lemon: {
    panel: 'lemon',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x121522, edge: 0xffe14d, accent: 0xe6b422, dim: 0x594b1b },
    halo: 0.014,
    beams: { count: 2, width: 0.016 },
    ambient: { color: 0xfff3b8, intensity: 1.26 },
    playerLight: 1.18,
    fog: 0.0073,
    core: { color: 0xffe14d, size: 7.5, opacity: 0.1, rays: 0, ring: 0 },
    dust: { n: 8, size: 0.045, opacity: 0.1, colors: [0xfff4a8, 0xffd166] },
    streak: { color: 0xffe45e, gain: 0.15 },
    windows: 0,
  },
  // 5. Призматический сон (Платный, 3400✦) — круглое сечение, индиго-свод и переливающийся спектральный контур
  prism: {
    panel: 'prism',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x170b33, edge: 0xe87aff, accent: 0x62d8f5, dim: 0x492785 },
    hueSway: { from: 0.5, to: 0.9, speed: 0.22, sat: 0.85, light: 0.66 }, // контур переливается циан → аметист → розовый
    halo: 0.02,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0xd4b8ff, intensity: 1.28 },
    playerLight: 1.2,
    fog: 0.0072,
    core: { color: 0xd982ff, size: 7.5, opacity: 0.1, rays: 0, ring: 0 },
    dust: { n: 8, size: 0.045, opacity: 0.1, colors: [0xf0a8ff, 0x8ce8ff] },
    streak: { color: 0xe298ff, gain: 0.16 },
    windows: 0,
  },
  // 6. Жерло вулкана (Платный, 1900✦) — спокойный полупрозрачный базальтовый каркас
  magma: {
    panel: 'magma',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x1a0806, edge: 0xff5e1f, accent: 0xd9380e, dim: 0x52190c },
    halo: 0.015,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0xffab88, intensity: 1.24 },
    playerLight: 1.2,
    fog: 0.0076,
    core: { color: 0xff5a1f, size: 7.5, opacity: 0.1, rays: 0, ring: 0 },
    dust: { n: 6, size: 0.045, opacity: 0.1, colors: [0xff7a2e, 0xffb866] },
    streak: { color: 0xff6e28, gain: 0.14 },
    windows: 0,
  },
  // 7. Кристальный разлом (Платный, 2600✦) — круглое сечение, ледяной свод и мерцающие блики по контуру
  crystal: {
    panel: 'crystal',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x0a1830, edge: 0xc8ecff, accent: 0x62b0f5, dim: 0x254f88 },
    hueSway: { from: 0.52, to: 0.62, speed: 0.2, sat: 0.7, light: 0.8 }, // контур мерцает льдисто-голубым
    halo: 0.02,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0xd6edff, intensity: 1.3 },
    playerLight: 1.22,
    fog: 0.0071,
    core: { color: 0xc8ecff, size: 7.5, opacity: 0.1, rays: 0, ring: 0 },
    dust: { n: 8, size: 0.045, opacity: 0.11, colors: [0xe6f7ff, 0x99d6ff] },
    streak: { color: 0xd6f0ff, gain: 0.16 },
    windows: 0,
  },
  // 8. Нулевая точка (Платный, 1400✦) — строгий полупрозрачный графитовый монолит с серебристой сеткой
  zero: {
    panel: 'zero',
    ribPattern: 'Mxxxxxxxxxxxxxxx',
    ribShape: 'round',
    ribColors: { body: 0x0b0e14, edge: 0xcfd6e2, accent: 0x7c8596, dim: 0x2c3240 },
    halo: 0.012,
    beams: { count: 2, width: 0.02 },
    ambient: { color: 0xb8c2d4, intensity: 1.18 },
    playerLight: 1.24,
    fog: 0.0075,
    core: { color: 0xd8dfe9, size: 7.5, opacity: 0.11, rays: 0, ring: 0.08 },
    dust: { n: 6, size: 0.042, opacity: 0.1, colors: [0xf2f5fa, 0x8e96a4] },
    streak: { color: 0xc8d0dc, gain: 0.14 },
    windows: 0,
  },
};

/** Угол i-го продольного луча: два луча идут по бокам, четыре — по диагоналям (дорожка внизу свободна). */
export function beamAngle(i: number, count: number): number {
  return count <= 2 ? i * Math.PI : ((i + 0.5) / count) * Math.PI * 2;
}

export function lookById(id: string): TunnelLook {
  return TUNNEL_LOOKS[id] ?? TUNNEL_LOOKS.pulse;
}

// ======================================================================
// Общие утилиты
// ======================================================================

/** Объединяет статичные геометрии в один буфер для сокращения draw calls с сохранением гладких нормалей и UV. */
export function mergeSimpleGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIdx = list.map((g) => {
    if (g.index) {
      const ni = g.toNonIndexed();
      g.dispose();
      return ni;
    }
    return g;
  });
  let total = 0;
  let hasNormal = true;
  let hasUv = true;
  for (const g of nonIdx) {
    total += g.getAttribute('position').count;
    if (!g.getAttribute('normal')) hasNormal = false;
    if (!g.getAttribute('uv')) hasUv = false;
  }
  const pos = new Float32Array(total * 3);
  const norm = hasNormal ? new Float32Array(total * 3) : null;
  const uv = hasUv ? new Float32Array(total * 2) : null;
  let posOffset = 0;
  let uvOffset = 0;
  for (const g of nonIdx) {
    const posArr = g.getAttribute('position').array as Float32Array;
    pos.set(posArr, posOffset);
    if (norm) {
      const normArr = g.getAttribute('normal').array as Float32Array;
      norm.set(normArr, posOffset);
    }
    if (uv) {
      const uvArr = g.getAttribute('uv').array as Float32Array;
      uv.set(uvArr, uvOffset);
    }
    posOffset += posArr.length;
    uvOffset += (posArr.length / 3) * 2;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (norm) out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexStr = (n: number) => '#' + n.toString(16).padStart(6, '0');

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ======================================================================
// Текстуры стен. Тайл 1024×1024 = 64 м тоннеля (8 секций по 8 м) × окружность.
// u=0/1 — пол (затемнён под дорожку), u=0.5 — потолок. Граница секции — y = k·128,
// именно на ней стоят рёбра, поэтому они всегда совпадают с линиями текстуры.
// ======================================================================
const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
const WALL_SS = IS_TOUCH_DEVICE ? 1 : 2;
const TW = 1024;
const TH = 1024;
const BAY = 128;
const BAYS = 8;

type Ctx = CanvasRenderingContext2D;

function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function hGrad(c: Ctx, stops: [number, string][]) {
  const g = c.createLinearGradient(0, 0, TW, 0);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, TW, TH);
}

/** Спокойный тёмный коридор у пола (края u), чтобы световая дорожка, игрок и препятствия читались идеально. */
function floorShade(c: Ctx, strength: number) {
  const g = c.createLinearGradient(0, 0, TW, 0);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.22, 'rgba(0,0,0,0)');
  g.addColorStop(0.78, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  c.fillStyle = g;
  c.fillRect(0, 0, TW, TH);
}

/** Яркость по окружности: 0.3 у пола → 1 на потолке. */
const ceilK = (x: number) => 0.3 + 0.7 * Math.sin((Math.PI * x) / TW);

function glowLine(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w: number, alpha: number, blur: number) {
  // Продольные линии (вдоль тоннеля) сходятся к точке схода — делаем их тоньше и бледнее, чтобы не шумели
  const longitudinal = x0 === x1 && Math.abs(y1 - y0) > TH * 0.5;
  if (longitudinal) {
    w *= 0.75;
    alpha *= 0.5;
    blur *= 0.4;
  }
  c.save();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.globalAlpha = alpha;
  if (blur > 0) {
    c.shadowColor = color;
    c.shadowBlur = blur * WALL_SS;
  }
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

/** Горизонтальная линия по всей окружности на границе секции — спокойный шов без яркого свечения. */
function bayLine(c: Ctx, y: number, color: string, w: number, alpha: number, _blur: number) {
  const softAlpha = Math.min(0.18, alpha * 0.24);
  glowLine(c, 0, y, TW, y, color, Math.min(1.2, w * 0.7), softAlpha, 0);
  if (y === 0) glowLine(c, 0, TH, TW, TH, color, Math.min(1.2, w * 0.7), softAlpha, 0);
}

/** Очень мягкий горизонтальный тон на границе секции (без ярких бегущих колец). */
function bayHalo(c: Ctx, y: number, color: string, halfH: number, alpha: number) {
  const softAlpha = Math.min(0.04, alpha * 0.22);
  const draw = (yy: number) => {
    const g = c.createLinearGradient(0, yy - halfH, 0, yy + halfH);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, softAlpha));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, yy - halfH, TW, halfH * 2);
  };
  draw(y);
  if (y === 0) draw(TH);
}

function wrapDraw(fn: (dx: number, dy: number) => void) {
  for (const dy of [-TH, 0, TH]) for (const dx of [-TW, 0, TW]) fn(dx, dy);
}

type Painter = (c: Ctx, p: WallPalette, look: TunnelLook) => void;

/**
 * 1. PULSE — «Холодный импульс» (Бесплатный)
 * Глубокая тёмно-синяя основа, крупные спокойные панели 8×4, редкие холодно-голубые кольца.
 */
const paintPulse: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.25, p.a], [0.5, p.b], [0.75, p.a], [1, p.c]]);

  // Крупные вытянутые архитектурные панели (8 по окружности × 4 по длине тайла)
  const W = 256;
  const H = 512;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const x = col * W + 4;
      const y = row * H + 4;
      const k = ceilK(x + W / 2);
      const g = c.createLinearGradient(0, y, 0, y + H - 8);
      g.addColorStop(0, `rgba(160,215,255,${0.045 * k})`);
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.28)');
      c.fillStyle = g;
      rrect(c, x, y, W - 8, H - 8, 6);
      c.fill();
    }
  }

  // Редкие световые кольца: только каждые 32 м (b = 0, 4)
  for (const b of [0, 4]) {
    const y = b * BAY;
    bayHalo(c, y, p.cool, 36, 0.14);
    bayLine(c, y, p.cool, 2.2, 0.72, 6);
  }

  floorShade(c, 0.56);
};

/**
 * 2. COPPER — «Медные кольца» (Бесплатный)
 * Матовый обсидианово-бронзовый свод, аккуратные сегментированные янтарные дуги, без мелкого декора.
 */
const paintCopper: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.28, p.a], [0.5, p.b], [0.72, p.a], [1, p.c]]);

  // Широкие матовые бронзовые секции (8 × 4)
  const W = 256;
  const H = 512;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const x = col * W + 4;
      const y = row * H + 4;
      const k = ceilK(x + W / 2);
      const g = c.createLinearGradient(x, 0, x + W - 8, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.22)');
      g.addColorStop(0.5, `rgba(255,180,100,${0.04 * k})`);
      g.addColorStop(1, 'rgba(0,0,0,0.22)');
      c.fillStyle = g;
      rrect(c, x, y, W - 8, H - 8, 5);
      c.fill();
    }
  }

  // Тонкие продольные тёмные швы
  c.strokeStyle = p.seam;
  c.lineWidth = 2.5;
  for (let col = 1; col < 4; col++) {
    c.beginPath();
    c.moveTo(col * W, 0);
    c.lineTo(col * W, TH);
    c.stroke();
  }

  // Сегментированные янтарные световые полосы каждые 16 м (b = 0, 2, 4, 6):
  // 4 длинные чистые дуги по окружности с выразительными паузами
  for (let b = 0; b < BAYS; b += 4) {
    const y = b * BAY;
    const major = b % 4 === 0;
    const drawSegs = (yy: number) => {
      for (let s = 0; s < 4; s++) {
        const segX = s * 256 + 22;
        const segW = 256 - 44;
        const k = ceilK(segX + segW / 2);
        const h = major ? 12 : 7;
        c.save();
        c.globalAlpha = (major ? 0.72 : 0.44) * (0.35 + 0.65 * k);
        const g = c.createLinearGradient(0, yy - h, 0, yy + h);
        g.addColorStop(0, rgba(p.cool, 0));
        g.addColorStop(0.5, major ? p.warm : p.cool);
        g.addColorStop(1, rgba(p.cool, 0));
        c.fillStyle = g;
        c.fillRect(segX, yy - h, segW, h * 2);
        glowLine(c, segX + 6, yy, segX + segW - 6, yy, major ? p.warm : p.cool, major ? 2.2 : 1.4, 0.85, major ? 6 : 3);
        c.restore();
      }
    };
    drawSegs(y);
    if (y === 0) drawSegs(TH);
  }

  floorShade(c, 0.58);
};

/**
 * 3. POLAR — «Полярная глубина» (Бесплатный)
 * Глубокий тёмно-бирюзовый фон и одна плавная лента сдержанных зелёно-бирюзовых и фиолетовых оттенков.
 */
const paintPolar: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.3, p.a], [0.5, p.b], [0.7, p.a], [1, p.c]]);

  // Плавная бесшовная лента полярного сияния в верхнем своде (без горизонтальных стыков)
  const STEPS = 128;
  const dy = TH / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const y0 = i * dy;
    const phase = (i / STEPS) * Math.PI * 2;
    const cx = TW * 0.5 + Math.sin(phase) * 115;
    const g1 = c.createLinearGradient(cx - 200, 0, cx + 200, 0);
    g1.addColorStop(0, 'rgba(77,230,207,0)');
    g1.addColorStop(0.5, `rgba(77,230,207,${0.12 + 0.035 * Math.cos(phase)})`);
    g1.addColorStop(1, 'rgba(77,230,207,0)');
    c.fillStyle = g1;
    c.fillRect(cx - 200, y0, 400, dy);

    const vx = cx - 90 * Math.cos(phase);
    const g2 = c.createLinearGradient(vx - 160, 0, vx + 160, 0);
    g2.addColorStop(0, 'rgba(118,98,245,0)');
    g2.addColorStop(0.5, 'rgba(118,98,245,0.085)');
    g2.addColorStop(1, 'rgba(118,98,245,0)');
    c.fillStyle = g2;
    c.fillRect(vx - 160, y0, 320, dy);
  }

  // Несколько мягких крупных световых пятен глубины (без мелкой ряби)
  const rnd = mulberry(3303);
  for (let i = 0; i < 6; i++) {
    const cx = TW * (0.22 + rnd() * 0.56);
    const cy = rnd() * TH;
    const r = 135 + rnd() * 70;
    wrapDraw((ox, oy) => {
      const g = c.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, rgba(p.cool, 0.065));
      g.addColorStop(1, rgba(p.cool, 0));
      c.fillStyle = g;
      c.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    });
  }

  // Редкие мягкие световые пояса только каждые 32 м (b = 0, 4)
  for (const b of [0]) {
    const y = b * BAY;
    bayHalo(c, y, p.cool, 44, 0.12);
    bayLine(c, y, p.warm, 1.5, 0.36, 5);
  }

  floorShade(c, 0.54);
};

/**
 * 4. LEMON — «Лимонный свет» (Платный, 900✦)
 * Благородная графитовая основа, мягкие матовые секции без лишних контурных линий и одно чистое лимонное кольцо на тайл.
 */
const paintLemon: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.28, p.a], [0.5, p.b], [0.72, p.a], [1, p.c]]);

  // Крупные гладкие матовые секции без обводки (убраны лишние продольные и поперечные линии)
  const W = 256;
  const H = 512;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const x = col * W + 6;
      const y = row * H + 8;
      const w = W - 12;
      const h = H - 16;
      const k = ceilK(x + w / 2);
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, `rgba(255,235,140,${0.055 * k})`);
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.34)');
      c.fillStyle = g;
      rrect(c, x, y, w, h, 8);
      c.fill();
    }
  }

  // Только одно необходимое золотисто-лимонное кольцо на границе тайла (b = 0)
  for (const b of [0]) {
    const y = b * BAY;
    bayHalo(c, y, p.cool, 32, 0.14);
    bayLine(c, y, p.cool, 1.8, 0.68, 4);
  }

  floorShade(c, 0.56);
};

/**
 * 5. PRISM — «Призматический сон» (Платный, 3400✦)
 * Глубокая индиго-фиолетовая основа, плавные спектральные переливы по своду (без граней) и редкое радужное кольцо.
 */
const paintPrism: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.28, p.a], [0.5, p.b], [0.72, p.a], [1, p.c]]);

  // Широкие мягкие спектральные «шлейфы» по окружности — цвет плавно перетекает вдоль тоннеля.
  // Диагональный сдвиг даёт перелив, а не полосы; тайл бесшовный (wrapDraw).
  const rnd = mulberry(5505);
  const hues = ['92,225,230', '182,140,255', '255,122,217', '120,160,255'];
  for (let i = 0; i < 9; i++) {
    const cx = TW * (0.2 + rnd() * 0.6);
    const cy = rnd() * TH;
    const r = 170 + rnd() * 120;
    const col = hues[i % hues.length];
    wrapDraw((ox, oy) => {
      const g = c.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, `rgba(${col},0.14)`);
      g.addColorStop(0.6, `rgba(${col},0.05)`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      c.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    });
  }

  // Сдержанный спектральный градиент на главном кольце (b = 0)
  const rg = c.createLinearGradient(0, 0, TW, 0);
  rg.addColorStop(0, 'rgba(92,225,230,0.1)');
  rg.addColorStop(0.32, '#64e8ff');
  rg.addColorStop(0.5, '#b69cff');
  rg.addColorStop(0.68, '#ff7ad9');
  rg.addColorStop(1, 'rgba(255,122,217,0.1)');
  for (const b of [0]) {
    const y = b * BAY;
    bayHalo(c, y, '#b68cff', 32, 0.14);
    const drawBand = (yy: number) => {
      c.save();
      c.strokeStyle = rg;
      c.lineWidth = 2.0;
      c.globalAlpha = 0.72;
      c.shadowColor = '#e87aff';
      c.shadowBlur = 5 * WALL_SS;
      c.beginPath();
      c.moveTo(0, yy);
      c.lineTo(TW, yy);
      c.stroke();
      c.restore();
    };
    drawBand(y);
    if (y === 0) drawBand(TH);
  }

  floorShade(c, 0.58);
};

/**
 * 6. MAGMA — «Жерло вулкана» (Платный, 1900✦)
 * Гладкий базальтовый монолит с редкими тлеющими поясами и спокойным глубоким жаром.
 */
const paintMagma: Painter = (c) => {
  const rnd = mulberry(6606);
  hGrad(c, [[0, '#090202'], [0.28, '#170604'], [0.5, '#220906'], [0.72, '#170604'], [1, '#090202']]);

  // Мягкие широкие переходы базальтовой породы
  for (let i = 0; i < 8; i++) {
    const x = rnd() * TW;
    const y = rnd() * TH;
    const r = 170 + rnd() * 150;
    const warm = i % 2 === 0;
    wrapDraw((dx, dy) => {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, warm ? 'rgba(230,65,18,0.05)' : 'rgba(0,0,0,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }

  // Редкие тлеющие пояса каждые 32 м (b = 0, 4) и тонкий углистый шов на b = 2, 6
  for (const b of [0, 4]) {
    const y = b * BAY;
    bayHalo(c, y, '#ff4814', 36, 0.15);
    bayLine(c, y, '#ff6a24', 2.0, 0.76, 8);
  }

  floorShade(c, 0.6);
};

/**
 * 7. CRYSTAL — «Кристальный разлом» (Платный, 2600✦)
 * Почти чёрная сапфировая основа, гладкий ледяной свод без граней: мягкие холодные отсветы и одно тонкое кольцо.
 */
const paintCrystal: Painter = (c, p) => {
  hGrad(c, [[0, p.dark], [0.3, p.c], [0.5, p.a], [0.7, p.c], [1, p.dark]]);

  // Крупные мягкие ледяные отсветы (без углов и граней)
  const rnd = mulberry(7707);
  for (let i = 0; i < 9; i++) {
    const cx = TW * (0.2 + rnd() * 0.6);
    const cy = rnd() * TH;
    const r = 150 + rnd() * 130;
    const icy = i % 3 !== 0;
    wrapDraw((ox, oy) => {
      const g = c.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, icy ? 'rgba(190,232,255,0.11)' : 'rgba(98,176,245,0.12)');
      g.addColorStop(1, 'rgba(60,120,220,0)');
      c.fillStyle = g;
      c.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    });
  }

  // Одно тонкое кристаллическое кольцо на тайл (b = 0)
  for (const b of [0]) {
    const y = b * BAY;
    bayHalo(c, y, p.cool, 28, 0.14);
    bayLine(c, y, p.glass, 1.8, 0.68, 5);
  }

  floorShade(c, 0.56);
};

/**
 * 8. ZERO — «Нулевая точка» (Платный, 1400✦)
 * Чистый графитовый монолит: длинные матовые антрацитовые плиты и тонкие серебристые швы без мелкого мусора.
 */
const paintZero: Painter = (c, p) => {
  hGrad(c, [[0, '#020305'], [0.28, p.a], [0.5, p.b], [0.72, p.a], [1, '#020305']]);

  // Строгие вытянутые матовые плиты 128×256 с тонкой серебристо-серой фаской
  const W = 256;
  const H = 512;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const x = col * W + 5;
      const y = row * H + 5;
      const w = W - 10;
      const h = H - 10;
      const k = ceilK(x + w / 2);

      const g = c.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, `rgba(180,190,210,${0.045 * k})`);
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.48)');
      c.fillStyle = g;
      rrect(c, x, y, w, h, 3);
      c.fill();

      c.strokeStyle = `rgba(180,188,204,${0.07 + 0.08 * k})`;
      c.lineWidth = 1;
      rrect(c, x + 0.5, y + 0.5, w - 1, h - 1, 3);
      c.stroke();
    }
  }

  // Тонкие продольные графитовые нити
  for (const x of [512]) {
    glowLine(c, x, 0, x, TH, '#b8c0ce', 1, 0.16 * ceilK(x), 0);
  }

  // Чёткие серебристые кольцевые швы каждые 32 м (b = 0, 4) и тонкая нить на b = 2, 6
  for (const b of [0, 4]) {
    const y = b * BAY;
    bayHalo(c, y, '#9aa2b2', 24, 0.1);
    bayLine(c, y, '#e4e9f2', 1.5, 0.65, 4);
  }

  floorShade(c, 0.64);
};

const PAINTERS: Record<PanelKind, Painter> = {
  pulse: paintPulse,
  copper: paintCopper,
  polar: paintPolar,
  lemon: paintLemon,
  prism: paintPrism,
  magma: paintMagma,
  crystal: paintCrystal,
  zero: paintZero,
};

/** Длина тайла стены в метрах — должна совпадать с Engine (8 колец × 8 м). */
export const WALL_TILE = 64;

/** Обшивка: мягкие цветные градиенты и ориентиры (~на 35% плотнее), без лишних линий у жёлтого тоннеля. */
function applySpatialTexture(c: Ctx, p: WallPalette, panel: PanelKind) {
  c.save();
  // Для жёлтого тоннеля (lemon) убираем дополнительные продольные линии текстуры, оставляя только необходимые
  if (panel !== 'lemon') {
    for (const x0 of [256, 768]) {
      const k = ceilK(x0);
      c.strokeStyle = rgba(p.cool, 0.08 * k + 0.02);
      c.lineWidth = 0.85;
      c.beginPath();
      c.moveTo(x0, 0);
      c.lineTo(x0, TH);
      c.stroke();
    }
  }

  // Цветной градиент по окружности (+35% к плотности стенок тоннеля)
  const arc = c.createLinearGradient(0, 0, TW, 0);
  arc.addColorStop(0, rgba(p.cool, 0));
  arc.addColorStop(0.2, rgba(p.cool, 0.18));
  arc.addColorStop(0.36, rgba(p.b, 0.30));
  arc.addColorStop(0.5, rgba(p.warm, 0.23));
  arc.addColorStop(0.64, rgba(p.b, 0.30));
  arc.addColorStop(0.8, rgba(p.cool, 0.18));
  arc.addColorStop(1, rgba(p.cool, 0));
  c.fillStyle = arc;
  c.fillRect(0, 0, TW, TH);

  // Широкие «волны» яркости вдоль тоннеля: мягкие, бесшовные (два периода на тайл), без линий
  for (const cy of [TH * 0.25, TH * 0.75]) {
    wrapDraw((ox, oy) => {
      const g = c.createLinearGradient(0, cy + oy - 150, 0, cy + oy + 150);
      g.addColorStop(0, rgba(p.cool, 0));
      g.addColorStop(0.5, rgba(p.cool, 0.10));
      g.addColorStop(1, rgba(p.cool, 0));
      c.fillStyle = g;
      c.fillRect(ox, cy + oy - 150, TW, 300);
    });
  }
  // у пола градиент гасим, чтобы дорожка и игрок читались
  floorShade(c, 0.44);
  c.restore();
}

export function paintWallTexture(look: TunnelLook, p: WallPalette, tiles: number, anisotropy: number): THREE.CanvasTexture {
  const cvs = document.createElement('canvas');
  cvs.width = TW * WALL_SS;
  cvs.height = TH * WALL_SS;
  const c = cvs.getContext('2d')!;
  c.scale(WALL_SS, WALL_SS);
  PAINTERS[look.panel](c, p, look);
  applySpatialTexture(c, p, look.panel);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.repeat.set(1, tiles);
  return tex;
}

// ======================================================================
// Рёбра тоннеля: общие геометрии и материалы на все кольца (~на 35% менее прозрачные)
// ======================================================================
export interface RibGeos {
  gBody: THREE.BufferGeometry;
  gEdge: THREE.BufferGeometry;
  gHalo: THREE.BufferGeometry;
  mBody: THREE.BufferGeometry;
  mEdge: THREE.BufferGeometry;
  minor: THREE.BufferGeometry;
  inner: THREE.BufferGeometry;
  seg: THREE.BufferGeometry;
}

export interface RibMats {
  body: THREE.MeshBasicMaterial;
  edge: THREE.MeshBasicMaterial;
  accent: THREE.MeshBasicMaterial;
  dim: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
}

export function createRibMats(): RibMats {
  return {
    body: new THREE.MeshBasicMaterial({ color: 0x101830, transparent: true, opacity: 0.94, depthWrite: false }),
    edge: new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.88, depthWrite: false }),
    accent: new THREE.MeshBasicMaterial({ color: 0x3a78d8, transparent: true, opacity: 0.54, depthWrite: false }),
    dim: new THREE.MeshBasicMaterial({ color: 0x294a8a, transparent: true, opacity: 0.48, depthWrite: false }),
    halo: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

function ringGeo(_shape: RibShape, apothem: number, tube: number, radial = 6): THREE.BufferGeometry {
  return new THREE.TorusGeometry(apothem, tube, radial, 56);
}

export function buildRibGeos(look: TunnelLook, tunnelR: number): RibGeos {
  const shape = look.ribShape;
  const R = tunnelR + 0.03;
  // Четыре длинные чистые сегментные дуги по своду (не заходят на дорожку внизу)
  const segN = 4;
  const arcs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < segN; i++) {
    const step = (Math.PI * 2) / segN;
    const arcLen = step * 0.68;
    const g = new THREE.TorusGeometry(tunnelR + 0.01, 0.055, 5, 16, arcLen);
    g.rotateZ(i * step - arcLen / 2);
    arcs.push(g);
  }
  return {
    gBody: ringGeo(shape, R, 0.16, 7),
    gEdge: ringGeo(shape, R - 0.14, 0.028, 4),
    gHalo: ringGeo(shape, R - 0.08, 0.22, 5),
    mBody: ringGeo(shape, R, 0.095, 6),
    mEdge: ringGeo(shape, R - 0.085, 0.022, 4),
    minor: ringGeo(shape, R, 0.028, 4),
    inner: ringGeo(shape, R - 0.16, 0.022, 4),
    seg: mergeSimpleGeometries(arcs),
  };
}

export function disposeRibGeos(g: RibGeos | null) {
  if (!g) return;
  for (const k of Object.keys(g) as (keyof RibGeos)[]) g[k].dispose();
}

/** Собирает набор меш-частей для ребра по символу ритма. */
export function ribPieces(letter: string, g: RibGeos, m: RibMats): THREE.Mesh[] {
  switch (letter) {
    case 'G': {
      const halo = new THREE.Mesh(g.gHalo, m.halo);
      halo.renderOrder = 2;
      return [new THREE.Mesh(g.gBody, m.body), new THREE.Mesh(g.gEdge, m.edge), halo];
    }
    case 'M':
      return [new THREE.Mesh(g.mBody, m.body), new THREE.Mesh(g.mEdge, m.edge)];
    case 'm':
      return [new THREE.Mesh(g.minor, m.dim)];
    case 'i':
      return [new THREE.Mesh(g.inner, m.accent)];
    case 's':
      return [new THREE.Mesh(g.seg, m.accent)];
    default:
      return [];
  }
}

// ======================================================================
// Ядро в конце тоннеля: лучи и тонкое кольцо
// ======================================================================
export function makeRaysTexture(): THREE.Texture {
  const S = 256;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  c.translate(S / 2, S / 2);
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const long = i % 2 === 0;
    const len = (S / 2) * (long ? 0.95 : 0.62);
    const w = long ? 0.055 : 0.04;
    const g = c.createRadialGradient(0, 0, 4, 0, 0, len);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len);
    c.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len);
    c.closePath();
    c.fill();
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeThinRingTexture(): THREE.Texture {
  const S = 256;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  c.strokeStyle = 'rgba(255,255,255,0.92)';
  c.lineWidth = 2.0;
  c.shadowColor = '#ffffff';
  c.shadowBlur = 7 * WALL_SS;
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 0.9;
  c.globalAlpha = 0.42;
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
  c.stroke();
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ======================================================================
// Превью для магазина (2D, 240×152) — согласовано с обновлённым образом каждого тоннеля
// ======================================================================
const previewCache = new Map<string, string>();

export function renderThemePreview(t: Theme): string {
  const hit = previewCache.get(t.id);
  if (hit) return hit;
  const look = t.look;
  const W = 240;
  const H = 152;
  const SC = 2;
  const cvs = document.createElement('canvas');
  cvs.width = W * SC;
  cvs.height = H * SC;
  const c = cvs.getContext('2d')!;
  c.scale(SC, SC);
  c.imageSmoothingQuality = 'high';
  const cx = W / 2;
  const cy = H * 0.43;
  const p = t.wall;
  const rc = look.ribColors;

  c.fillStyle = t.sky;
  c.fillRect(0, 0, W, H);

  const N = 12;
  const RMAX = Math.hypot(W, H) * 0.64;
  const radius = (i: number) => RMAX / (1 + i * 0.58);

  const polyPath = (r: number) => {
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
  };

  // Секции стен от дальних к ближним
  for (let i = N; i >= 0; i--) {
    const rNear = radius(i);
    const rFar = radius(i + 1);
    const fog = Math.min(1, (i / N) * 1.05);

    const g = c.createRadialGradient(cx, cy, rFar, cx, cy, rNear);
    g.addColorStop(0, p.c);
    g.addColorStop(0.55, p.a);
    g.addColorStop(1, p.b);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, rNear * 1.02, 0, Math.PI * 2);
    c.arc(cx, cy, rFar, 0, Math.PI * 2, true);
    c.fill('evenodd');

    // Туман глубины
    c.fillStyle = t.sky;
    c.globalAlpha = fog * 0.84;
    c.beginPath();
    c.arc(cx, cy, rNear * 1.02, 0, Math.PI * 2);
    c.arc(cx, cy, rFar, 0, Math.PI * 2, true);
    c.fill('evenodd');
    c.globalAlpha = 1;
  }

  // Индивидуальный атмосферный акцент каждого тоннеля в превью
  if (look.panel === 'polar') {
    // Плавная вуаль полярного сияния в верхнем своде (мягкие градиенты без жёсткого контура)
    const a1 = c.createRadialGradient(cx - 26, cy - 28, 4, cx - 22, cy - 26, 68);
    a1.addColorStop(0, 'rgba(77,230,207,0.34)');
    a1.addColorStop(0.55, 'rgba(77,230,207,0.12)');
    a1.addColorStop(1, 'rgba(77,230,207,0)');
    c.fillStyle = a1;
    c.fillRect(0, 0, W, H);

    const a2 = c.createRadialGradient(cx + 34, cy - 22, 4, cx + 30, cy - 20, 64);
    a2.addColorStop(0, 'rgba(118,98,245,0.3)');
    a2.addColorStop(0.55, 'rgba(77,230,207,0.1)');
    a2.addColorStop(1, 'rgba(118,98,245,0)');
    c.fillStyle = a2;
    c.fillRect(0, 0, W, H);
  } else if (look.panel === 'prism') {
    // Мягкий спектральный отсвет в верхнем своде
    const sg = c.createLinearGradient(cx - 75, cy - 50, cx + 75, cy + 10);
    sg.addColorStop(0, 'rgba(92,225,230,0)');
    sg.addColorStop(0.35, 'rgba(92,225,230,0.16)');
    sg.addColorStop(0.55, 'rgba(182,140,255,0.2)');
    sg.addColorStop(0.78, 'rgba(232,122,255,0.16)');
    sg.addColorStop(1, 'rgba(232,122,255,0)');
    c.fillStyle = sg;
    c.fillRect(0, 0, W, H);
  } else if (look.panel === 'magma') {
    // Мягкое тлеющее тепло в глубине базальта
    const mg = c.createRadialGradient(cx, cy, 6, cx, cy, W * 0.48);
    mg.addColorStop(0, 'rgba(255,90,30,0.28)');
    mg.addColorStop(0.6, 'rgba(180,28,8,0.12)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = mg;
    c.fillRect(0, 0, W, H);
  }

  // Рёбра по просторному ритму тоннеля (сдвиг фазы +14 выводит главное кольцо G на i=2 и M на i=10)
  for (let i = N; i >= 0; i--) {
    const rNear = radius(i);
    const fog = Math.min(1, (i / N) * 1.05);
    const letter = look.ribPattern[(i + 14) % look.ribPattern.length];
    const vis = Math.max(0, 1 - fog * 0.78);
    if (vis <= 0.02 || letter === 'x') continue;

    c.save();
    c.globalAlpha = vis;
    if (letter === 'G' || letter === 'M') {
      const big = letter === 'G';
      polyPath(rNear);
      c.strokeStyle = hexStr(rc.body);
      c.lineWidth = rNear * (big ? 0.055 : 0.035) + 0.8;
      c.stroke();

      polyPath(rNear * 0.965);
      if (look.panel === 'prism') {
        const pg = c.createLinearGradient(cx - rNear, cy - rNear * 0.5, cx + rNear, cy + rNear * 0.5);
        pg.addColorStop(0, '#5ce1e6');
        pg.addColorStop(0.5, '#b69cff');
        pg.addColorStop(1, '#ff7ad9');
        c.strokeStyle = pg;
      } else {
        c.strokeStyle = hexStr(rc.edge);
      }
      c.shadowColor = hexStr(rc.edge);
      c.shadowBlur = (big ? 7 : 4) * SC;
      c.lineWidth = big ? 1.6 : 1.15;
      c.stroke();
    } else if (letter === 'm') {
      polyPath(rNear);
      c.strokeStyle = hexStr(rc.dim);
      c.lineWidth = 0.75;
      c.globalAlpha = vis * 0.65;
      c.stroke();
    } else if (letter === 'i') {
      polyPath(rNear * 0.93);
      c.strokeStyle = hexStr(rc.accent);
      c.shadowColor = hexStr(rc.accent);
      c.shadowBlur = 4 * SC;
      c.lineWidth = 1.0;
      c.globalAlpha = vis * 0.78;
      c.stroke();
    } else if (letter === 's') {
      polyPath(rNear);
      const perim = 2 * Math.PI * rNear;
      c.setLineDash([perim * 0.17, perim * 0.08]);
      c.strokeStyle = hexStr(rc.accent);
      c.shadowColor = hexStr(rc.accent);
      c.shadowBlur = 5 * SC;
      c.lineWidth = rNear * 0.026 + 1.0;
      c.stroke();
      c.setLineDash([]);
    }
    c.restore();
  }

  // Тонкие продольные направляющие
  c.save();
  const bn = look.beams.count;
  for (let i = 0; i < bn; i++) {
    const a = beamAngle(i, bn);
    if (Math.sin(a) > 0.45) continue; // не перекрываем дорожку внизу
    const g = c.createLinearGradient(cx, cy, cx + Math.cos(a) * RMAX, cy + Math.sin(a) * RMAX);
    g.addColorStop(0, hexStr(t.beam) + '00');
    g.addColorStop(1, hexStr(t.beam) + '44');
    c.strokeStyle = g;
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * RMAX, cy + Math.sin(a) * RMAX);
    c.stroke();
  }
  c.restore();

  // Световая дорожка и тонкие перила
  const runG = c.createLinearGradient(cx, cy + 18, cx, H);
  runG.addColorStop(0, hexStr(t.runway) + '00');
  runG.addColorStop(1, hexStr(t.runway) + '88');
  c.fillStyle = runG;
  c.beginPath();
  c.moveTo(cx - 2.5, cy + 18);
  c.lineTo(cx + 2.5, cy + 18);
  c.lineTo(cx + 36, H);
  c.lineTo(cx - 36, H);
  c.closePath();
  c.fill();

  c.strokeStyle = hexStr(t.rail);
  c.shadowColor = hexStr(t.rail);
  c.shadowBlur = 4 * SC;
  c.globalAlpha = 0.72;
  c.lineWidth = 1.4;
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + d * 4.5, cy + 18);
    c.lineTo(cx + d * 48, H);
    c.stroke();
  }
  c.shadowBlur = 0;
  c.globalAlpha = 1;

  // Спокойное ядро в глубине тоннеля
  const cr = 8 + look.core.size * 1.45;
  const core = c.createRadialGradient(cx, cy, 0, cx, cy, cr * 1.35);
  core.addColorStop(0, look.panel === 'zero' ? '#050608' : '#ffffff');
  core.addColorStop(look.panel === 'zero' ? 0.32 : 0.22, hexStr(look.core.color) + 'dd');
  core.addColorStop(1, hexStr(look.core.color) + '00');
  c.fillStyle = core;
  c.globalAlpha = Math.min(1, look.core.opacity + 0.18);
  c.beginPath();
  c.arc(cx, cy, cr * 1.35, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;

  if (look.core.ring > 0) {
    c.strokeStyle = '#ffffff';
    c.globalAlpha = look.core.ring;
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(cx, cy, cr * 0.78, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  }

  // Мягкая виньетка по краям карточки
  const vg = c.createRadialGradient(cx, cy, H * 0.42, cx, cy, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.48)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);

  const url = cvs.toDataURL('image/png');
  previewCache.set(t.id, url);
  return url;
}

// ======================================================================
// Задний фон (SkyDome) высокого разрешения — индивидуальный для каждого тоннеля,
// без пикселизации, без лишних элементов и со спокойной чистой зоной в конце тоннеля.
// ======================================================================
export interface SkyDome {
  mesh: THREE.Mesh;
  setTheme(panel: PanelKind): void;
  update(time: number, lightK: number): void;
  dispose(): void;
}

const SKY_MODE: Record<PanelKind, number> = {
  pulse: 0,
  copper: 1,
  polar: 2,
  lemon: 3,
  zero: 4,
  magma: 5,
  crystal: 6,
  prism: 7,
};

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uMode;
  uniform float uTime;
  uniform float uLight;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float rAxis = length(d.xy);
    // В конце тоннеля (вокруг оси -Z) фон максимально чистый и ровный, чтобы ничто не мешало обзору
    float периферия = smoothstep(0.24, 0.72, rAxis);
    float ang = atan(d.y, d.x);
    float yNorm = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 col = vec3(0.06, 0.10, 0.20);

    if (uMode < 0.5) {
      // 0. Холодный импульс (Бесплатный) — чистый кобальтово-голубой стратосферный градиент
      vec3 cTop = vec3(0.11, 0.22, 0.44);
      vec3 cMid = vec3(0.07, 0.14, 0.29);
      vec3 cBot = vec3(0.04, 0.08, 0.18);
      col = mix(cBot, cTop, smoothstep(0.0, 1.0, yNorm));
      float band = exp(-pow((d.y - 0.15) * 3.2, 2.0));
      col += cMid * band * 0.45 * периферия;
    } else if (uMode < 1.5) {
      // 1. Медные кольца (Бесплатный) — тёплый бронзово-янтарный закатный свод
      vec3 cTop = vec3(0.22, 0.13, 0.08);
      vec3 cHor = vec3(0.34, 0.19, 0.10);
      vec3 cBot = vec3(0.09, 0.05, 0.03);
      col = mix(cBot, cTop, yNorm);
      float glow = exp(-pow((d.y - 0.05) * 2.8, 2.0));
      col = mix(col, cHor, glow * 0.55 * периферия);
    } else if (uMode < 2.5) {
      // 2. Полярная глубина (Бесплатный) — чистый арктический свод с мягкой лентой сияния вверху
      vec3 cBase = mix(vec3(0.03, 0.11, 0.15), vec3(0.07, 0.24, 0.30), yNorm);
      float wave = sin(ang * 2.0 + uTime * 0.12) * 0.12;
      float ribbon = exp(-pow((d.y - 0.38 - wave) * 4.5, 2.0)) * step(0.0, d.y);
      col = cBase + vec3(0.12, 0.48, 0.42) * ribbon * 0.42 * периферия;
    } else if (uMode < 3.5) {
      // 3. Лимонный свет (900✦) — благородный индиго-графит с тёплым золотистым солнечным ореолом
      vec3 cBase = mix(vec3(0.07, 0.08, 0.15), vec3(0.14, 0.16, 0.28), yNorm);
      float sunArc = exp(-pow((rAxis - 0.68) * 3.6, 2.0)) * (0.55 + 0.45 * sin(ang - uTime * 0.08));
      vec3 gold = mix(vec3(0.42, 0.33, 0.10), vec3(0.68, 0.56, 0.18), yNorm);
      col = cBase + gold * sunArc * 0.52 * периферия;
    } else if (uMode < 4.5) {
      // 4. Нулевая точка (1400✦) — строгий платиново-антрацитовый монолит с серебристым гало затмения
      vec3 cBase = mix(vec3(0.05, 0.07, 0.11), vec3(0.13, 0.16, 0.23), yNorm);
      float halo = exp(-pow((rAxis - 0.62) * 4.8, 2.0));
      float sheen = 0.6 + 0.4 * cos(ang * 2.0 + uTime * 0.06);
      col = cBase + vec3(0.32, 0.36, 0.44) * halo * sheen * 0.55 * периферия;
    } else if (uMode < 5.5) {
      // 5. Жерло вулкана (Премиум, 1900✦) — глубокое термальное небо с шелковистыми потоками магмы
      vec3 cBase = mix(vec3(0.10, 0.03, 0.02), vec3(0.24, 0.07, 0.04), yNorm);
      float flow1 = sin(ang * 3.0 + d.z * 2.2 - uTime * 0.14);
      float flow2 = cos(ang * 2.0 - d.y * 3.0 + uTime * 0.1);
      float vein = smoothstep(0.15, 0.85, 0.5 + 0.5 * flow1 * flow2);
      vec3 ember = mix(vec3(0.45, 0.11, 0.04), vec3(0.75, 0.28, 0.08), vein);
      col = cBase + ember * vein * 0.48 * периферия;
    } else if (uMode < 6.5) {
      // 6. Кристальный разлом (Премиум, 2600✦) — сапфирово-ледяной эфир с тонкими каустиками преломления
      vec3 cBase = mix(vec3(0.04, 0.10, 0.22), vec3(0.10, 0.25, 0.48), yNorm);
      float c1 = sin(ang * 4.0 + d.y * 3.5 + uTime * 0.12);
      float c2 = cos(ang * 3.0 - d.x * 3.5 - uTime * 0.09);
      float caustic = pow(max(0.0, 0.5 + 0.5 * c1 * c2), 2.4);
      vec3 ice = mix(vec3(0.22, 0.52, 0.88), vec3(0.62, 0.88, 1.0), caustic);
      col = cBase + ice * caustic * 0.52 * периферия;
    } else {
      // 7. Призматический сон (Флагманский премиум, 3400✦) — королевский индиго с переливающимися спектральными вуалями
      vec3 cBase = mix(vec3(0.07, 0.04, 0.18), vec3(0.16, 0.09, 0.34), yNorm);
      float ph = ang * 1.5 + d.y * 1.8 + uTime * 0.11;
      vec3 spec = 0.5 + 0.5 * cos(6.28318 * (ph * 0.28 + vec3(0.0, 0.33, 0.67)));
      float silk = pow(0.5 + 0.5 * sin(ang * 3.0 - d.y * 2.5 + uTime * 0.15), 2.0);
      vec3 prismCol = mix(vec3(0.32, 0.72, 0.92), mix(vec3(0.68, 0.42, 0.98), vec3(0.92, 0.38, 0.78), spec.r), spec.g);
      col = cBase + prismCol * (0.22 + 0.42 * silk) * периферия;
    }

    // Освещённость фона мягко масштабируется от запаса света, но никогда не уходит в глухую тьму
    float lum = 0.72 + 0.38 * uLight;
    gl_FragColor = vec4(col * lum, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSkyDome(): SkyDome {
  const geo = new THREE.SphereGeometry(310, 40, 28);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uMode: { value: 0 },
      uTime: { value: 0 },
      uLight: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;

  return {
    mesh,
    setTheme(panel: PanelKind) {
      mat.uniforms.uMode.value = SKY_MODE[panel] ?? 0;
    },
    update(time: number, lightK: number) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uLight.value = lightK;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
