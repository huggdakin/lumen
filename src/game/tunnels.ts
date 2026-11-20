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

export type PanelKind = 'pulse' | 'copper' | 'polar' | 'current' | 'prism' | 'corona' | 'crystal' | 'zero';
export type RibShape = 'round' | 'octa' | 'hex';

export interface TunnelLook {
  panel: PanelKind;
  /**
   * Ритм рёбер, период 16 колец (по 8 м): G — большое ребро, M — среднее, m — тонкое,
   * i — внутреннее малое кольцо, s — сегментное кольцо, x — пусто.
   * Тяжёлые символы стоят на чётных позициях — там у стены «сильная» граница секции.
   */
  ribPattern: string;
  ribShape: RibShape;
  ribColors: { body: number; edge: number; accent: number; dim: number };
  halo: number; // мягкое свечение вокруг больших рёбер (0..0.2)
  hueSway?: { from: number; to: number; speed: number }; // переливание кромки (HSL hue 0..1)
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
  // 1. Холодный импульс — чистый, аккуратный, умеренное свечение
  pulse: {
    panel: 'pulse',
    ribPattern: 'GmimMmimMmxmMmim',
    ribShape: 'round',
    ribColors: { body: 0x0d1838, edge: 0x6fd0ff, accent: 0x3a78d8, dim: 0x294a8a },
    halo: 0.07,
    beams: { count: 6, width: 0.05 },
    ambient: { color: 0x7d95e8, intensity: 1.0 },
    playerLight: 1,
    fog: 0.011,
    core: { color: 0x7ac8ff, size: 10, opacity: 0.5, rays: 0, ring: 0 },
    dust: { n: 40, size: 0.06, opacity: 0.3, colors: [0xbfe0ff] },
    streak: { color: 0x7ac8ff, gain: 1 },
    windows: 0,
  },
  // 2. Медные кольца — тёмный металл, янтарные сегменты
  copper: {
    panel: 'copper',
    ribPattern: 'GmsmMmimGmsmMmxm',
    ribShape: 'round',
    ribColors: { body: 0x1c130d, edge: 0xffb347, accent: 0xff9a2e, dim: 0x6b4423 },
    halo: 0.05,
    beams: { count: 4, width: 0.06 },
    ambient: { color: 0xffc890, intensity: 0.95 },
    playerLight: 1,
    fog: 0.0125,
    core: { color: 0xffa040, size: 9, opacity: 0.35, rays: 0, ring: 0 },
    dust: { n: 28, size: 0.06, opacity: 0.38, colors: [0xffc080, 0xffe0b0] },
    streak: { color: 0xffb03a, gain: 0.9 },
    windows: 0,
  },
  // 3. Полярная глубина — глубокий сине-зелёный градиент, мягкое сияние
  polar: {
    panel: 'polar',
    ribPattern: 'GxmxixmxMxmxixmx',
    ribShape: 'round',
    ribColors: { body: 0x082a38, edge: 0x7ff3dc, accent: 0x3fc8d8, dim: 0x1c6a7a },
    halo: 0.1,
    beams: { count: 6, width: 0.05 },
    ambient: { color: 0x7fd8e8, intensity: 1.0 },
    playerLight: 0.95,
    fog: 0.012,
    core: { color: 0x58f0d0, size: 12, opacity: 0.5, rays: 0, ring: 0 },
    dust: { n: 70, size: 0.08, opacity: 0.36, colors: [0xb0fff0, 0x80e0ff] },
    streak: { color: 0x7fffe8, gain: 0.9 },
    windows: 0,
  },
  // 4. Подводное течение — стекло и металл, бирюза, глубина
  current: {
    panel: 'current',
    ribPattern: 'GmimMmiMGmimMmix',
    ribShape: 'round',
    ribColors: { body: 0x0a3640, edge: 0x6ffff0, accent: 0x2ad0d8, dim: 0x2a8a96 },
    halo: 0.09,
    beams: { count: 8, width: 0.05 },
    ambient: { color: 0x80f0e8, intensity: 1.0 },
    playerLight: 1,
    fog: 0.0125,
    core: { color: 0x40f0e0, size: 12, opacity: 0.55, rays: 0, ring: 0 },
    dust: { n: 46, size: 0.09, opacity: 0.4, colors: [0xc8fff8] },
    streak: { color: 0x6ffff0, gain: 1 },
    windows: 0,
  },
  // 5. Призматический сон — грани, розово-фиолетовый свет
  prism: {
    panel: 'prism',
    ribPattern: 'GxmxMximGxmxMxix',
    ribShape: 'hex',
    ribColors: { body: 0x230f44, edge: 0xff7ad9, accent: 0xb69cff, dim: 0x7b4cc8 },
    halo: 0.09,
    hueSway: { from: 0.74, to: 0.93, speed: 0.35 },
    beams: { count: 6, width: 0.05 },
    ambient: { color: 0xd8a8ff, intensity: 1.05 },
    playerLight: 1.05,
    fog: 0.01,
    core: { color: 0xff8ae0, size: 12, opacity: 0.6, rays: 0, ring: 0 },
    dust: { n: 44, size: 0.07, opacity: 0.45, colors: [0xff9ae8, 0xc0a0ff, 0x9ae8ff] },
    streak: { color: 0xffa0ee, gain: 1 },
    windows: 0,
  },
  // 6. Солнечная корона — золото, бронза, яркий центр и лучи
  corona: {
    panel: 'corona',
    ribPattern: 'GmsmMmsmGmsmMmsx',
    ribShape: 'round',
    ribColors: { body: 0x24150a, edge: 0xffd35a, accent: 0xffb020, dim: 0x8a5a1c },
    halo: 0.05,
    beams: { count: 8, width: 0.04 },
    ambient: { color: 0xffd890, intensity: 1.0 },
    playerLight: 1,
    fog: 0.0115,
    core: { color: 0xffd35a, size: 14, opacity: 0.9, rays: 0.55, ring: 0 },
    dust: { n: 48, size: 0.07, opacity: 0.4, colors: [0xffe090, 0xfff2c0] },
    streak: { color: 0xffd35a, gain: 1 },
    windows: 0,
  },
  // 7. Кристальный разлом — кристаллические панели, ледяные блики
  crystal: {
    panel: 'crystal',
    ribPattern: 'GxmxMxmxGxixMxmx',
    ribShape: 'octa',
    ribColors: { body: 0x0a1830, edge: 0xcfeeff, accent: 0x8ad0ff, dim: 0x3a6a9a },
    halo: 0.1,
    beams: { count: 5, width: 0.06 },
    ambient: { color: 0xcfe6ff, intensity: 1.1 },
    playerLight: 1.1,
    fog: 0.01,
    core: { color: 0xcfeaff, size: 10, opacity: 0.55, rays: 0, ring: 0 },
    dust: { n: 36, size: 0.06, opacity: 0.45, colors: [0xe8f8ff] },
    streak: { color: 0xdff2ff, gain: 0.9 },
    windows: 0,
  },
  // 8. Нулевая точка — обсидиан с побежалостью: тонкие спектральные нити, переливающаяся кромка,
  //    сингулярность в конце тоннеля (белое ядро, лучи и кольцо аккреции)
  zero: {
    panel: 'zero',
    ribPattern: 'GmMmimMmGmMmimMm',
    ribShape: 'round',
    ribColors: { body: 0x07080f, edge: 0xf2f6ff, accent: 0xa9b8ff, dim: 0x3a4272 },
    halo: 0.11,
    hueSway: { from: 0.5, to: 0.86, speed: 0.2 },
    beams: { count: 6, width: 0.035 },
    ambient: { color: 0xb8c4ff, intensity: 0.85 },
    playerLight: 1.25,
    fog: 0.0105,
    core: { color: 0xf4f7ff, size: 16, opacity: 1.0, rays: 0.5, ring: 0.75 },
    dust: { n: 34, size: 0.055, opacity: 0.55, colors: [0xffffff, 0xa8c4ff, 0xd8a8ff, 0x9ff4ff] },
    streak: { color: 0xe4ecff, gain: 0.85 },
    windows: 0,
  },
};

export function lookById(id: string): TunnelLook {
  return TUNNEL_LOOKS[id] ?? TUNNEL_LOOKS.pulse;
}

// ======================================================================
// Общие утилиты
// ======================================================================

/** Объединяет статичные геометрии в один буфер для сокращения draw calls. */
export function mergeSimpleGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIdx = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of nonIdx) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  let offset = 0;
  for (const g of nonIdx) {
    const arr = g.getAttribute('position').array as Float32Array;
    pos.set(arr, offset);
    offset += arr.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
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
const TW = 1024;
const TH = 1024;
const CELL = 64;
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

/** Затемнение у пола (края u), чтобы световая дорожка и объекты читались. */
function floorShade(c: Ctx, strength: number) {
  const g = c.createLinearGradient(0, 0, TW, 0);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.2, 'rgba(0,0,0,0)');
  g.addColorStop(0.8, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  c.fillStyle = g;
  c.fillRect(0, 0, TW, TH);
}

/** Яркость по окружности: 0.35 у пола → 1 на потолке. */
const ceilK = (x: number) => 0.35 + 0.65 * Math.sin((Math.PI * x) / TW);

function glowLine(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w: number, alpha: number, blur: number) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.globalAlpha = alpha;
  c.shadowColor = color;
  c.shadowBlur = blur;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

/** Горизонтальная линия по всей окружности на границе секции (с учётом шва тайла). */
function bayLine(c: Ctx, y: number, color: string, w: number, alpha: number, blur: number) {
  glowLine(c, 0, y, TW, y, color, w, alpha, blur);
  if (y === 0) glowLine(c, 0, TH, TW, TH, color, w, alpha, blur);
}

function wrapDraw(fn: (dx: number, dy: number) => void) {
  for (const dy of [-TH, 0, TH]) for (const dx of [-TW, 0, TW]) fn(dx, dy);
}

/** Сетка с периодическим дрожанием вершин (тайл остаётся бесшовным). */
function jitterGrid(cols: number, rows: number, amp: number, ampY: (r: number) => number, seed: number) {
  const rnd = mulberry(seed);
  const ox: number[][] = [];
  const oy: number[][] = [];
  for (let r = 0; r < rows; r++) {
    ox.push([]);
    oy.push([]);
    for (let q = 0; q < cols; q++) {
      ox[r].push((rnd() - 0.5) * 2 * amp);
      oy[r].push((rnd() - 0.5) * 2 * ampY(r));
    }
  }
  const cs = TW / cols;
  const rs = TH / rows;
  return (r: number, q: number): [number, number] => [q * cs + ox[r % rows][q % cols], r * rs + oy[r % rows][q % cols]];
}

type Painter = (c: Ctx, p: WallPalette, look: TunnelLook) => void;

const paintPulse: Painter = (c, p, look) => {
  const rnd = mulberry(1101);
  hGrad(c, [[0, p.c], [0.25, p.a], [0.5, p.b], [0.75, p.a], [1, p.c]]);
  // Чистые плиты со скошенным светом сверху
  for (let col = 0; col < 16; col++) {
    for (let row = 0; row < 16; row++) {
      const x = col * CELL + 2;
      const y = row * CELL + 2;
      const s = CELL - 4;
      const g = c.createLinearGradient(0, y, 0, y + s);
      g.addColorStop(0, 'rgba(255,255,255,0.08)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      g.addColorStop(1, 'rgba(0,0,0,0.24)');
      c.fillStyle = g;
      rrect(c, x, y, s, s, 5);
      c.fill();
    }
  }
  // Продольные световые полосы
  for (const x of [192, 448, 576, 832]) glowLine(c, x, 0, x, TH, p.cool, 2, 0.32, 6);
  // Рёберные линии секций: чередуем сильные и слабые
  for (let b = 0; b <= BAYS; b++) {
    const y = b * BAY;
    if (b % 2 === 0) {
      const g = c.createLinearGradient(0, y - 34, 0, y + 34);
      g.addColorStop(0, rgba(p.cool, 0));
      g.addColorStop(0.5, rgba(p.cool, 0.2));
      g.addColorStop(1, rgba(p.cool, 0));
      c.fillStyle = g;
      c.fillRect(0, y - 34, TW, 68);
      if (y === 0) c.fillRect(0, TH - 34, TW, 68);
      bayLine(c, y, p.cool, 3, 0.85, 8);
    } else {
      bayLine(c, y, p.cool, 1.5, 0.28, 3);
    }
  }
  // Редкие иллюминаторы в космос
  if (look.windows > 0) {
    for (let col = 0; col < 16; col++) {
      for (let row = 0; row < 16; row++) {
        if (row % 2 === 0 || col < 3 || col > 12) continue;
        if (rnd() > look.windows * 4) continue;
        const x = col * CELL;
        const y = row * CELL;
        c.clearRect(x + 10, y + 12, CELL - 20, CELL - 24);
        c.strokeStyle = 'rgba(206,232,255,0.5)';
        c.lineWidth = 2;
        rrect(c, x + 10, y + 12, CELL - 20, CELL - 24, 8);
        c.stroke();
      }
    }
  }
  floorShade(c, 0.4);
};

const paintCopper: Painter = (c, p) => {
  const rnd = mulberry(2202);
  hGrad(c, [[0, p.c], [0.3, p.a], [0.5, p.b], [0.7, p.a], [1, p.c]]);
  // Матовые металлические пластины с мягким бликом по центру
  for (let col = 0; col < 16; col++) {
    for (let row = 0; row < 16; row++) {
      const x = col * CELL + 2;
      const y = row * CELL + 2;
      const g = c.createLinearGradient(x, 0, x + CELL - 4, 0);
      g.addColorStop(0, 'rgba(255,190,120,0)');
      g.addColorStop(0.45, `rgba(255,190,120,${0.05 + rnd() * 0.05})`);
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      c.fillStyle = g;
      c.fillRect(x, y, CELL - 4, CELL - 4);
    }
  }
  c.strokeStyle = p.seam;
  c.lineWidth = 3;
  for (let i = 0; i <= 16; i++) {
    c.beginPath();
    c.moveTo(i * CELL, 0);
    c.lineTo(i * CELL, TH);
    c.stroke();
  }
  // Янтарные сегменты на чётных границах секций (3 из 4, с тёмными разрывами)
  for (let b = 0; b <= BAYS; b += 2) {
    const y = b * BAY;
    const drawBand = (yy: number) => {
      for (let col = 0; col < 16; col++) {
        if (col % 4 === 3) continue;
        const x = col * CELL + 4;
        const k = ceilK(x + 28);
        c.save();
        c.globalAlpha = 0.35 + 0.65 * k;
        c.shadowColor = p.cool;
        c.shadowBlur = 12;
        const g = c.createLinearGradient(0, yy - 16, 0, yy + 16);
        g.addColorStop(0, '#4a2a0c');
        g.addColorStop(0.5, p.cool);
        g.addColorStop(1, '#4a2a0c');
        c.fillStyle = g;
        c.fillRect(x, yy - 16, CELL - 8, 32);
        c.restore();
      }
    };
    drawBand(y);
    if (y === 0) drawBand(TH);
  }
  for (let b = 1; b < BAYS; b += 2) bayLine(c, b * BAY, p.cool, 2, 0.3, 3);
  // Редкие световые метки в середине секций
  for (let i = 0; i < 7; i++) {
    const col = 3 + Math.floor(rnd() * 10);
    const bay = Math.floor(rnd() * BAYS);
    const x = col * CELL + CELL / 2 - 3;
    const y = bay * BAY + BAY / 2 - 15;
    c.save();
    c.shadowColor = p.warm;
    c.shadowBlur = 12;
    c.fillStyle = p.warm;
    c.globalAlpha = 0.9;
    c.fillRect(x, y, 6, 30);
    c.restore();
  }
  floorShade(c, 0.45);
};

const paintPolar: Painter = (c, p) => {
  const rnd = mulberry(3303);
  hGrad(c, [[0, p.c], [0.5, p.b], [1, p.c]]);
  // Широкие мягкие вертикальные полосы сияния
  for (const pos of [0.24, 0.5, 0.76]) {
    const x = TW * pos;
    const g = c.createLinearGradient(x - 110, 0, x + 110, 0);
    g.addColorStop(0, rgba(p.cool, 0));
    g.addColorStop(0.5, rgba(p.cool, 0.12));
    g.addColorStop(1, rgba(p.cool, 0));
    c.fillStyle = g;
    c.fillRect(x - 110, 0, 220, TH);
  }
  // Биолюминесцентные «пятна» глубины
  for (let i = 0; i < 16; i++) {
    const cx = rnd() * TW;
    const cy = rnd() * TH;
    const rx = 90 + rnd() * 90;
    const ry = 40 + rnd() * 60;
    const a = (0.1 + rnd() * 0.12) * ceilK(cx);
    wrapDraw((dx, dy) => {
      c.save();
      c.translate(cx + dx, cy + dy);
      c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(p.cool, a));
      g.addColorStop(1, rgba(p.cool, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });
  }
  // Мягкие световые пояса на границах секций
  for (let b = 0; b <= BAYS; b++) {
    const y = b * BAY;
    const strong = b % 2 === 0;
    const h = strong ? 54 : 30;
    const g = c.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, rgba(p.cool, 0));
    g.addColorStop(0.5, rgba(p.cool, strong ? 0.2 : 0.09));
    g.addColorStop(1, rgba(p.cool, 0));
    c.fillStyle = g;
    c.fillRect(0, y - h, TW, h * 2);
    if (y === 0) c.fillRect(0, TH - h, TW, h * 2);
    bayLine(c, y, p.warm, strong ? 1.6 : 1, strong ? 0.4 : 0.14, strong ? 6 : 0);
  }
  c.strokeStyle = rgba(p.seam, 0.5);
  c.lineWidth = 2;
  for (let j = 0; j < 8; j++) {
    c.beginPath();
    c.moveTo(j * 128, 0);
    c.lineTo(j * 128, TH);
    c.stroke();
  }
  floorShade(c, 0.4);
};

const paintCurrent: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.3, p.a], [0.5, p.b], [0.7, p.a], [1, p.c]]);
  // Металлические рамы и стеклянные панели с диагональным бликом
  for (let col = 0; col < 16; col++) {
    for (let b = 0; b < BAYS; b++) {
      for (let half = 0; half < 2; half++) {
        const x = col * CELL + 4;
        const y = b * BAY + half * 64 + 6;
        const w = CELL - 8;
        const h = 64 - 12;
        c.fillStyle = 'rgba(0,12,16,0.5)';
        rrect(c, x, y, w, h, 6);
        c.fill();
        const gx = x + 4;
        const gy = y + 4;
        const gw = w - 8;
        const gh = h - 8;
        const g = c.createLinearGradient(0, gy, 0, gy + gh);
        g.addColorStop(0, rgba(p.glass, 0.2));
        g.addColorStop(1, rgba(p.dark, 0.5));
        c.fillStyle = g;
        rrect(c, gx, gy, gw, gh, 4);
        c.fill();
        // диагональный блик
        c.save();
        rrect(c, gx, gy, gw, gh, 4);
        c.clip();
        c.fillStyle = `rgba(255,255,255,${0.1 + ((col * 7 + b * 3 + half) % 4) * 0.025})`;
        c.beginPath();
        c.moveTo(gx + gw * 0.15, gy + gh);
        c.lineTo(gx + gw * 0.5, gy + gh);
        c.lineTo(gx + gw * 0.85, gy);
        c.lineTo(gx + gw * 0.5, gy);
        c.closePath();
        c.fill();
        c.restore();
        c.strokeStyle = rgba(p.cool, 0.4);
        c.lineWidth = 1.2;
        rrect(c, gx, gy, gw, gh, 4);
        c.stroke();
      }
    }
  }
  // Течение: плавные светлые линии вдоль тоннеля (период укладывается в тайл)
  for (let i = 0; i < 5; i++) {
    const x0 = 140 + i * 186;
    const n = 2 + (i % 2);
    c.save();
    c.strokeStyle = rgba(p.glass, 0.16);
    c.lineWidth = 3;
    c.shadowColor = p.cool;
    c.shadowBlur = 8;
    c.beginPath();
    for (let y = 0; y <= TH; y += 8) {
      const x = x0 + Math.sin((y / TH) * Math.PI * 2 * n + i) * 22;
      if (y === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.restore();
  }
  // Тёмные мульоны на границах секций
  for (let b = 0; b <= BAYS; b++) {
    const y = b * BAY;
    const strong = b % 2 === 0;
    const hh = strong ? 14 : 7;
    c.fillStyle = 'rgba(2,14,18,0.85)';
    c.fillRect(0, y - hh, TW, hh * 2);
    if (y === 0) c.fillRect(0, TH - hh, TW, hh * 2);
    bayLine(c, y, p.cool, strong ? 2 : 1, strong ? 0.8 : 0.3, strong ? 6 : 0);
  }
  floorShade(c, 0.45);
};

const paintPrism: Painter = (c, p) => {
  const rnd = mulberry(5505);
  c.fillStyle = p.seam;
  c.fillRect(0, 0, TW, TH);
  const COLS = 16;
  const ROWS = 16;
  const V = jitterGrid(COLS, ROWS, 9, (r) => (r % 2 === 0 ? 0 : 9), 77);
  const tri = (a: [number, number], b: [number, number], d: [number, number], hue: number, lightA: number, lightB: number, sat: number, edgeBright: boolean) => {
    const g = c.createLinearGradient(a[0], a[1], (b[0] + d[0]) / 2, (b[1] + d[1]) / 2);
    g.addColorStop(0, `hsl(${hue},${sat}%,${lightA}%)`);
    g.addColorStop(1, `hsl(${(hue + 18) % 360},${sat}%,${lightB}%)`);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.lineTo(d[0], d[1]);
    c.closePath();
    c.fill();
    c.save();
    c.strokeStyle = edgeBright ? 'rgba(255,200,250,0.7)' : 'rgba(255,190,255,0.16)';
    c.lineWidth = edgeBright ? 1.6 : 1;
    if (edgeBright) {
      c.shadowColor = '#ff7ad9';
      c.shadowBlur = 6;
    }
    c.stroke();
    c.restore();
  };
  for (let r = 0; r < ROWS; r++) {
    for (let q = 0; q < COLS; q++) {
      const v00 = V(r, q);
      const v01 = V(r, q + 1);
      const v11 = V(r + 1, q + 1);
      const v10 = V(r + 1, q);
      const fk = 0.55 + 0.45 * Math.sin((Math.PI * (q + 0.5)) / COLS);
      // розово-фиолетовая гамма: 265°…345°
      const base = 268 + ((q * 5 + r * 3) % 11) * 4.6;
      const flip = (q + r) % 2 === 0;
      const mk = () => ({ h: (base + rnd() * 14) % 360, l: (10 + rnd() * 13) * fk, bright: rnd() < 0.07 });
      const t1 = mk();
      const t2 = mk();
      const sat = 46 + rnd() * 12;
      if (flip) {
        tri(v00, v01, v11, t1.h, t1.l + 6, t1.l, sat, t1.bright);
        tri(v00, v11, v10, t2.h, t2.l + 6, t2.l, sat, t2.bright);
      } else {
        tri(v00, v01, v10, t1.h, t1.l + 6, t1.l, sat, t1.bright);
        tri(v01, v11, v10, t2.h, t2.l + 6, t2.l, sat, t2.bright);
      }
    }
  }
  // Радужные линии рёбер секций
  const rg = c.createLinearGradient(0, 0, TW, 0);
  rg.addColorStop(0, '#9ae8ff');
  rg.addColorStop(0.3, '#ff7ad9');
  rg.addColorStop(0.55, '#b69cff');
  rg.addColorStop(0.8, '#ff7ad9');
  rg.addColorStop(1, '#9ae8ff');
  for (let b = 0; b <= BAYS; b++) {
    const y = b * BAY;
    const strong = b % 2 === 0;
    const draw = (yy: number) => {
      c.save();
      c.strokeStyle = rg;
      c.lineWidth = strong ? 3 : 1.4;
      c.globalAlpha = strong ? 0.85 : 0.3;
      c.shadowColor = '#ff7ad9';
      c.shadowBlur = strong ? 8 : 0;
      c.beginPath();
      c.moveTo(0, yy);
      c.lineTo(TW, yy);
      c.stroke();
      c.restore();
    };
    draw(y);
    if (y === 0) draw(TH);
  }
  floorShade(c, 0.5);
};

const paintCorona: Painter = (c, p) => {
  hGrad(c, [[0, p.c], [0.3, p.a], [0.5, p.b], [0.7, p.a], [1, p.c]]);
  for (let col = 0; col < 16; col++) {
    for (let row = 0; row < 16; row++) {
      const x = col * CELL + 2;
      const y = row * CELL + 2;
      const g = c.createLinearGradient(0, y, 0, y + CELL - 4);
      g.addColorStop(0, 'rgba(255,200,120,0.07)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      c.fillStyle = g;
      rrect(c, x, y, CELL - 4, CELL - 4, 4);
      c.fill();
    }
  }
  // Мягкие золотые лучи вдоль тоннеля
  for (let col = 1; col < 16; col += 2) {
    const x = col * CELL;
    glowLine(c, x, 0, x, TH, p.cool, 2, 0.18 * ceilK(x), 10);
  }
  // Золотые сегменты: широкие на чётных границах, узкие на нечётных
  for (let b = 0; b <= BAYS; b++) {
    const y = b * BAY;
    const strong = b % 2 === 0;
    const hh = strong ? 13 : 6;
    const band = (yy: number) => {
      for (let col = 0; col < 16; col++) {
        const x = col * CELL + 3;
        const k = ceilK(x + 29);
        c.save();
        c.globalAlpha = (strong ? 0.3 : 0.2) + (strong ? 0.5 : 0.3) * k;
        c.shadowColor = p.cool;
        c.shadowBlur = strong ? 14 : 4;
        const g = c.createLinearGradient(0, yy - hh, 0, yy + hh);
        g.addColorStop(0, '#6a4210');
        g.addColorStop(0.5, p.cool);
        g.addColorStop(0.75, '#d99a1e');
        g.addColorStop(1, '#6a4210');
        c.fillStyle = g;
        // скошенные сегменты
        c.beginPath();
        c.moveTo(x + 5, yy - hh);
        c.lineTo(x + CELL - 11, yy - hh);
        c.lineTo(x + CELL - 6, yy + hh);
        c.lineTo(x, yy + hh);
        c.closePath();
        c.fill();
        c.restore();
      }
    };
    band(y);
    if (y === 0) band(TH);
  }
  floorShade(c, 0.5);
};

const paintCrystal: Painter = (c, p) => {
  const rnd = mulberry(7707);
  c.fillStyle = p.dark;
  c.fillRect(0, 0, TW, TH);
  const COLS = 16;
  const ROWS = 16;
  const V = jitterGrid(COLS, ROWS, 13, (r) => (r % 2 === 0 ? 0 : 14), 91);
  const sparkles: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let q = 0; q < COLS; q++) {
      if (rnd() < 0.1) continue; // тёмные провалы между кристаллами
      const v00 = V(r, q);
      const v01 = V(r, q + 1);
      const v11 = V(r + 1, q + 1);
      const v10 = V(r + 1, q);
      const cxm = (v00[0] + v01[0] + v11[0] + v10[0]) / 4;
      const cym = (v00[1] + v01[1] + v11[1] + v10[1]) / 4;
      const inset = (v: [number, number]): [number, number] => [cxm + (v[0] - cxm) * 0.9, cym + (v[1] - cym) * 0.9];
      const a = inset(v00);
      const b = inset(v01);
      const d = inset(v11);
      const e = inset(v10);
      const fk = 0.5 + 0.5 * Math.sin((Math.PI * (q + 0.5)) / COLS);
      const g = c.createLinearGradient(a[0], a[1], d[0], d[1]);
      const lift = rnd();
      g.addColorStop(0, rgba(p.b, 0.35 + lift * 0.4));
      g.addColorStop(0.55, rgba(p.a, 0.9));
      g.addColorStop(1, rgba(p.c, 1));
      c.globalAlpha = 0.45 + 0.55 * fk;
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.lineTo(d[0], d[1]);
      c.lineTo(e[0], e[1]);
      c.closePath();
      c.fill();
      // грань: светлая кромка сверху
      c.globalAlpha = 0.25 + 0.4 * fk;
      c.strokeStyle = p.glass;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
      c.globalAlpha = 1;
      if (rnd() < 0.2) glowLine(c, b[0], b[1], d[0], d[1], '#ffffff', 1.3, 0.8 * fk, 4);
      if (rnd() < 0.035 && fk > 0.6) sparkles.push([cxm, cym]);
    }
  }
  for (const [x, y] of sparkles) {
    glowLine(c, x - 6, y, x + 6, y, '#ffffff', 1.1, 0.8, 4);
    glowLine(c, x, y - 6, x, y + 6, '#ffffff', 1.1, 0.8, 4);
  }
  floorShade(c, 0.5);
};

/** Спектральный градиент «побежалости» по окружности тайла — бесшовный (на краях совпадает). */
function spectrumGrad(c: Ctx, alpha: number): CanvasGradient {
  const g = c.createLinearGradient(0, 0, TW, 0);
  const stops: [number, string][] = [
    [0, `rgba(120,236,255,${alpha})`],
    [0.2, `rgba(130,160,255,${alpha})`],
    [0.4, `rgba(196,140,255,${alpha})`],
    [0.5, `rgba(255,230,250,${alpha})`],
    [0.6, `rgba(255,140,216,${alpha})`],
    [0.8, `rgba(150,170,255,${alpha})`],
    [1, `rgba(120,236,255,${alpha})`],
  ];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function specLine(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, alpha: number, blur: number) {
  c.save();
  c.strokeStyle = spectrumGrad(c, 1);
  c.lineWidth = w;
  c.globalAlpha = alpha;
  c.shadowColor = 'rgba(190,200,255,0.9)';
  c.shadowBlur = blur;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

/**
 * «Нулевая точка» — обсидиановая обшивка: глянцевые скошенные плиты, внутри каждой — тонкая
 * спектральная инкрустация-ромб (побежалость), шов секции — двойная световая нить.
 */
const paintZero: Painter = (c, p) => {
  hGrad(c, [[0, '#020208'], [0.22, p.a], [0.5, '#1a1f38'], [0.78, p.a], [1, '#020208']]);

  // Крупные глянцевые плиты 128×128 со скосом и диагональным бликом
  for (let col = 0; col < 8; col++) {
    for (let bay = 0; bay < BAYS; bay++) {
      const x = col * 128 + 6;
      const y = bay * BAY + 6;
      const s = 116;
      const k = ceilK(x + s / 2);
      const g = c.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, `rgba(190,205,255,${0.1 * k + 0.02})`);
      g.addColorStop(0.42, 'rgba(120,140,220,0.02)');
      g.addColorStop(0.58, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      c.fillStyle = g;
      rrect(c, x, y, s, s, 7);
      c.fill();
      // фаска: светлая сверху-слева, тёмная снизу-справа
      c.lineWidth = 1.5;
      c.strokeStyle = `rgba(215,228,255,${0.1 + 0.2 * k})`;
      c.beginPath();
      c.moveTo(x + 7, y + 0.8);
      c.lineTo(x + s - 7, y + 0.8);
      c.moveTo(x + 0.8, y + 7);
      c.lineTo(x + 0.8, y + s - 7);
      c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.beginPath();
      c.moveTo(x + 7, y + s - 0.8);
      c.lineTo(x + s - 7, y + s - 0.8);
      c.moveTo(x + s - 0.8, y + 7);
      c.lineTo(x + s - 0.8, y + s - 7);
      c.stroke();
    }
  }

  // Спектральная инкрустация: ромб в ромбе и светящаяся точка по центру каждой плиты
  for (let col = 0; col < 8; col++) {
    for (let bay = 0; bay < BAYS; bay++) {
      const cx = col * 128 + 64;
      const cy = bay * BAY + 64;
      const k = ceilK(cx);
      const diamond = (r: number, w: number, a: number, blur: number) => {
        c.save();
        c.strokeStyle = spectrumGrad(c, 1);
        c.lineWidth = w;
        c.globalAlpha = a * k;
        c.shadowColor = 'rgba(180,200,255,0.9)';
        c.shadowBlur = blur;
        c.beginPath();
        c.moveTo(cx, cy - r);
        c.lineTo(cx + r, cy);
        c.lineTo(cx, cy + r);
        c.lineTo(cx - r, cy);
        c.closePath();
        c.stroke();
        c.restore();
      };
      diamond(40, 1.6, 0.7, 6);
      diamond(19, 1.2, 0.5, 4);
      c.save();
      c.fillStyle = '#ffffff';
      c.globalAlpha = 0.85 * k;
      c.shadowColor = '#cfdcff';
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(cx, cy, 2.4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // Продольные нити между рядами плит
  for (const x of [256, 384, 512, 640, 768]) {
    glowLine(c, x, 0, x, TH, '#dfe8ff', 1, 0.14 + 0.16 * ceilK(x), 3);
  }
  specLine(c, 512, 0, 512, TH, 1.4, 0.35, 6);

  // Швы секций: сильные — широкая подсветка + двойная белая/спектральная нить, слабые — тонкая нить
  for (let b = 0; b <= BAYS; b++) {
    const y = b * BAY;
    const strong = b % 2 === 0;
    const draw = (yy: number) => {
      if (strong) {
        const g = c.createLinearGradient(0, yy - 30, 0, yy + 30);
        g.addColorStop(0, 'rgba(200,215,255,0)');
        g.addColorStop(0.5, 'rgba(200,215,255,0.16)');
        g.addColorStop(1, 'rgba(200,215,255,0)');
        c.fillStyle = g;
        c.fillRect(0, yy - 30, TW, 60);
        glowLine(c, 0, yy, TW, yy, '#ffffff', 1.8, 0.85, 7);
        specLine(c, 0, yy - 7, TW, yy - 7, 1.3, 0.7, 5);
        specLine(c, 0, yy + 7, TW, yy + 7, 1.3, 0.7, 5);
        // световые «заклёпки» на стыках плит
        for (let col = 1; col < 8; col++) {
          const px = col * 128;
          c.save();
          c.fillStyle = '#ffffff';
          c.globalAlpha = 0.35 + 0.6 * ceilK(px);
          c.shadowColor = '#bcd0ff';
          c.shadowBlur = 8;
          c.beginPath();
          c.arc(px, yy, 3, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      } else {
        glowLine(c, 0, yy, TW, yy, '#cfdcff', 1, 0.22, 3);
      }
    };
    draw(y);
    if (y === 0) draw(TH);
  }
  floorShade(c, 0.6);
};

const PAINTERS: Record<PanelKind, Painter> = {
  pulse: paintPulse,
  copper: paintCopper,
  polar: paintPolar,
  current: paintCurrent,
  prism: paintPrism,
  corona: paintCorona,
  crystal: paintCrystal,
  zero: paintZero,
};

/** Длина тайла стены в метрах — должна совпадать с Engine (8 колец × 8 м). */
export const WALL_TILE = 64;

export function paintWallTexture(look: TunnelLook, p: WallPalette, tiles: number, anisotropy: number): THREE.CanvasTexture {
  const cvs = document.createElement('canvas');
  cvs.width = TW;
  cvs.height = TH;
  const c = cvs.getContext('2d')!;
  PAINTERS[look.panel](c, p, look);
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
// Рёбра тоннеля: общие геометрии и материалы на все кольца
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
    body: new THREE.MeshBasicMaterial({ color: 0x101830 }),
    edge: new THREE.MeshBasicMaterial({ color: 0x6fd0ff }),
    accent: new THREE.MeshBasicMaterial({ color: 0x3a78d8 }),
    dim: new THREE.MeshBasicMaterial({ color: 0x294a8a, transparent: true, opacity: 0.85 }),
    halo: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

function ringGeo(shape: RibShape, apothem: number, tube: number, radial = 6): THREE.BufferGeometry {
  if (shape === 'round') return new THREE.TorusGeometry(apothem, tube, radial, 44);
  const n = shape === 'hex' ? 6 : 8;
  const R = apothem / Math.cos(Math.PI / n); // апофема = радиус «стенки», вершины уходят в обшивку
  const g = new THREE.TorusGeometry(R, tube, radial, n);
  if (n === 8) g.rotateZ(Math.PI / 8); // плоская грань — внизу, у дорожки
  return g;
}

export function buildRibGeos(look: TunnelLook, tunnelR: number): RibGeos {
  const shape = look.ribShape;
  const R = shape === 'hex' ? tunnelR - 0.22 : shape === 'octa' ? tunnelR - 0.05 : tunnelR + 0.02;
  const segN = look.panel === 'corona' ? 12 : 16;
  const arcs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < segN; i++) {
    const step = (Math.PI * 2) / segN;
    const g = new THREE.TorusGeometry(tunnelR, look.panel === 'corona' ? 0.1 : 0.085, 5, 4, step * 0.64);
    g.rotateZ(i * step);
    arcs.push(g);
  }
  return {
    gBody: ringGeo(shape, R, 0.22, 7),
    gEdge: ringGeo(shape, R - 0.2, 0.034, 4),
    gHalo: ringGeo(shape, R - 0.1, 0.27, 5),
    mBody: ringGeo(shape, R, 0.12, 6),
    mEdge: ringGeo(shape, R - 0.11, 0.028, 4),
    minor: ringGeo(shape, R, 0.04, 4),
    inner: ringGeo(shape, R - 0.42, 0.028, 4),
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
      return [new THREE.Mesh(g.seg, m.accent), new THREE.Mesh(g.minor, m.dim)];
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
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const long = i % 2 === 0;
    const len = (S / 2) * (long ? 1 : 0.68);
    const w = long ? 0.07 : 0.05;
    const g = c.createRadialGradient(0, 0, 4, 0, 0, len);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
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
  c.strokeStyle = 'rgba(255,255,255,0.95)';
  c.lineWidth = 2.4;
  c.shadowColor = '#ffffff';
  c.shadowBlur = 8;
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 1;
  c.globalAlpha = 0.5;
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
  c.stroke();
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ======================================================================
// Превью для магазина (2D, 240×152) — по тем же данным, что и 3D-сцена
// ======================================================================
const previewCache = new Map<string, string>();

export function renderThemePreview(t: Theme): string {
  const hit = previewCache.get(t.id);
  if (hit) return hit;
  const look = t.look;
  const W = 240;
  const H = 152;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const c = cvs.getContext('2d')!;
  const cx = W / 2;
  const cy = H * 0.43;
  const rnd = mulberry(t.id.length * 977 + t.price);
  const p = t.wall;
  const rc = look.ribColors;

  c.fillStyle = t.sky;
  c.fillRect(0, 0, W, H);

  const N = 15;
  const RMAX = Math.hypot(W, H) * 0.64;
  const radius = (i: number) => RMAX / (1 + i * 0.62);

  const polyPath = (r: number, rot = 0) => {
    const n = look.ribShape === 'hex' ? 6 : look.ribShape === 'octa' ? 8 : 0;
    c.beginPath();
    if (!n) {
      c.arc(cx, cy, r, 0, Math.PI * 2);
      return;
    }
    const R = r / Math.cos(Math.PI / n);
    const off = n === 8 ? Math.PI / 8 : 0;
    for (let k = 0; k <= n; k++) {
      const a = off + rot + (k / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  };

  // Мягкий свет глубины
  const bg = c.createRadialGradient(cx, cy, 2, cx, cy, W * 0.55);
  bg.addColorStop(0, hexStr(look.core.color) + '55');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  const SECT = 20;
  for (let i = N; i >= 0; i--) {
    const rNear = radius(i);
    const rFar = radius(i + 1);
    const fog = Math.min(1, (i / N) * 1.1);
    // стена между кольцами
    const g = c.createRadialGradient(cx, cy, rFar, cx, cy, rNear);
    g.addColorStop(0, i % 2 === 0 ? p.c : p.a);
    g.addColorStop(1, i % 2 === 0 ? p.a : p.b);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, rNear * 1.02, 0, Math.PI * 2);
    c.arc(cx, cy, rFar, 0, Math.PI * 2, true);
    c.fill('evenodd');

    // грани для призмы / кристалла
    if (look.panel === 'prism' || look.panel === 'crystal') {
      for (let s = 0; s < SECT; s++) {
        const a0 = (s / SECT) * Math.PI * 2;
        const a1 = ((s + 1) / SECT) * Math.PI * 2;
        const hueBase = look.panel === 'prism' ? 268 + ((s * 5 + i * 3) % 11) * 4.6 : 205 + rnd() * 20;
        const light = look.panel === 'prism' ? 12 + rnd() * 14 : 20 + rnd() * 34;
        const sat = look.panel === 'prism' ? 62 : 55;
        if (look.panel === 'crystal' && rnd() < 0.12) continue;
        c.fillStyle = `hsla(${hueBase},${sat}%,${light}%,${0.7 * (1 - fog * 0.6)})`;
        c.beginPath();
        c.moveTo(cx + Math.cos(a0) * rFar, cy + Math.sin(a0) * rFar);
        c.lineTo(cx + Math.cos(a0 + 0.02) * rNear, cy + Math.sin(a0 + 0.02) * rNear);
        c.lineTo(cx + Math.cos(a1) * rNear, cy + Math.sin(a1) * rNear);
        c.lineTo(cx + Math.cos(a1) * rFar, cy + Math.sin(a1) * rFar);
        c.closePath();
        c.fill();
        if (rnd() < 0.18) {
          c.strokeStyle = look.panel === 'prism' ? 'rgba(255,190,250,0.55)' : 'rgba(255,255,255,0.7)';
          c.lineWidth = 0.8;
          c.stroke();
        }
      }
    }

    // туман глубины
    c.fillStyle = t.sky;
    c.globalAlpha = fog * 0.82;
    c.beginPath();
    c.arc(cx, cy, rNear * 1.02, 0, Math.PI * 2);
    c.arc(cx, cy, rFar, 0, Math.PI * 2, true);
    c.fill('evenodd');
    c.globalAlpha = 1;

    // ребро по ритму
    const letter = look.ribPattern[i % 16];
    const vis = 1 - fog * 0.8;
    c.save();
    c.globalAlpha = vis;
    if (letter === 'G' || letter === 'M') {
      const big = letter === 'G';
      polyPath(rNear);
      c.strokeStyle = hexStr(rc.body);
      c.lineWidth = rNear * (big ? 0.07 : 0.04) + 1;
      c.stroke();
      polyPath(rNear * 0.96);
      c.strokeStyle = hexStr(rc.edge);
      c.shadowColor = hexStr(rc.edge);
      c.shadowBlur = big ? 9 : 4;
      c.lineWidth = big ? 1.6 : 1;
      c.stroke();
    } else if (letter === 'm') {
      polyPath(rNear);
      c.strokeStyle = hexStr(rc.dim);
      c.lineWidth = 0.8;
      c.globalAlpha = vis * 0.8;
      c.stroke();
    } else if (letter === 'i') {
      polyPath(rNear * 0.91);
      c.strokeStyle = hexStr(rc.accent);
      c.lineWidth = 0.9;
      c.globalAlpha = vis * 0.7;
      c.stroke();
    } else if (letter === 's') {
      polyPath(rNear);
      c.setLineDash([rNear * 0.34, rNear * 0.17]);
      c.strokeStyle = hexStr(rc.accent);
      c.shadowColor = hexStr(rc.accent);
      c.shadowBlur = 5;
      c.lineWidth = rNear * 0.03 + 1;
      c.stroke();
      c.setLineDash([]);
    }
    c.restore();
  }

  // Продольные лучи
  c.save();
  const bn = look.beams.count;
  for (let i = 0; i < bn; i++) {
    const a = ((i + 0.5) / bn) * Math.PI * 2;
    if (Math.abs(Math.sin(a - Math.PI / 2)) < 0.22 && Math.cos(a - Math.PI / 2) > 0) continue;
    const g = c.createLinearGradient(cx, cy, cx + Math.cos(a) * RMAX, cy + Math.sin(a) * RMAX);
    g.addColorStop(0, hexStr(t.beam) + '00');
    g.addColorStop(1, hexStr(t.beam) + '66');
    c.strokeStyle = g;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * RMAX, cy + Math.sin(a) * RMAX);
    c.stroke();
  }
  c.restore();

  // Дорожка и перила
  const runG = c.createLinearGradient(cx, cy + 20, cx, H);
  runG.addColorStop(0, hexStr(t.runway) + '00');
  runG.addColorStop(1, hexStr(t.runway) + 'aa');
  c.fillStyle = runG;
  c.beginPath();
  c.moveTo(cx - 3, cy + 20);
  c.lineTo(cx + 3, cy + 20);
  c.lineTo(cx + 40, H);
  c.lineTo(cx - 40, H);
  c.closePath();
  c.fill();
  c.strokeStyle = hexStr(t.rail);
  c.shadowColor = hexStr(t.rail);
  c.shadowBlur = 6;
  c.globalAlpha = 0.85;
  c.lineWidth = 1.8;
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + d * 5, cy + 20);
    c.lineTo(cx + d * 54, H);
    c.stroke();
  }
  c.shadowBlur = 0;
  c.globalAlpha = 1;

  // Ядро: лучи, кольцо и свечение
  const cr = 9 + look.core.size * 1.7;
  if (look.core.rays > 0) {
    c.save();
    c.translate(cx, cy);
    c.globalAlpha = look.core.rays * 0.45;
    c.fillStyle = hexStr(look.core.color);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const len = cr * (i % 2 === 0 ? 2.8 : 1.9);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a - 0.05) * len, Math.sin(a - 0.05) * len);
      c.lineTo(Math.cos(a + 0.05) * len, Math.sin(a + 0.05) * len);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
  const core = c.createRadialGradient(cx, cy, 0, cx, cy, cr * 1.4);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.25, hexStr(look.core.color) + 'ee');
  core.addColorStop(1, hexStr(look.core.color) + '00');
  c.fillStyle = core;
  c.globalAlpha = Math.min(1, look.core.opacity + 0.2);
  c.beginPath();
  c.arc(cx, cy, cr * 1.4, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  if (look.core.ring > 0) {
    c.strokeStyle = '#ffffff';
    c.globalAlpha = look.core.ring;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, cr * 0.95, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  }

  // Умеренные частицы
  const dots = Math.round(look.dust.n / 7);
  for (let i = 0; i < dots; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 14 + rnd() * 70;
    c.fillStyle = hexStr(look.dust.colors[i % look.dust.colors.length]);
    c.globalAlpha = 0.3 + rnd() * 0.4;
    c.fillRect(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 0.9, 1.2, 1.2);
  }
  c.globalAlpha = 1;

  // Виньетка
  const vg = c.createRadialGradient(cx, cy, H * 0.45, cx, cy, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);

  const url = cvs.toDataURL('image/png');
  previewCache.set(t.id, url);
  return url;
}
