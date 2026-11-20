import * as THREE from 'three';
import { skinById, type Skin, type SparkShape } from './state';

// ---------------- Быстрый бесшовный 3D-шум для сферических текстур ----------------

function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1274126177) + Math.imul(seed, 1597334677);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const c000 = hash3(ix, iy, iz, seed);
  const c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed);
  const c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed);
  const c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

function fbm3(x: number, y: number, z: number, seed: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise3(x, y, z, seed + i * 31);
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return v / norm;
}

function ridged3(x: number, y: number, z: number, seed: number, octaves = 3): number {
  let v = 0;
  let amp = 0.55;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x, y, z, seed + i * 47) * 2 - 1);
    v += amp * n * n;
    norm += amp;
    x *= 2.15;
    y *= 2.15;
    z *= 2.15;
    amp *= 0.5;
  }
  return v / norm;
}

function unpackRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// ---------------- Процедурные текстуры скинов (кэшируются один раз) ----------------

interface SkinTexBundle {
  coreCanvas: HTMLCanvasElement;
  coreTex: THREE.CanvasTexture;
  veilTex: THREE.CanvasTexture;
  coronaTex: THREE.CanvasTexture;
  discTex: THREE.CanvasTexture;
  flameTex: THREE.CanvasTexture;
}

const texCache = new Map<string, SkinTexBundle>();
const previewCache = new Map<string, string>();

function buildCoreAndVeilCanvases(skin: Skin): { coreCanvas: HTMLCanvasElement; veilCanvas: HTMLCanvasElement } {
  const W = 256;
  const H = 128;
  const coreCanvas = document.createElement('canvas');
  coreCanvas.width = W;
  coreCanvas.height = H;
  const cCtx = coreCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(W, H);
  const cd = cImg.data;

  const veilCanvas = document.createElement('canvas');
  veilCanvas.width = W;
  veilCanvas.height = H;
  const vCtx = veilCanvas.getContext('2d')!;
  const vImg = vCtx.createImageData(W, H);
  const vd = vImg.data;

  const colCore = unpackRgb(skin.core);
  const colMid = unpackRgb(skin.mid);
  const colGlow = unpackRgb(skin.glow);
  const colTrail = unpackRgb(skin.trail);
  const shape = skin.shape;
  const seed = skin.id.charCodeAt(0) * 131 + skin.id.charCodeAt(skin.id.length - 1) * 37;

  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W;
      const theta = u * Math.PI * 2;
      const nx = sinPhi * Math.cos(theta);
      const ny = cosPhi;
      const nz = sinPhi * Math.sin(theta);

      let r = 255;
      let g = 255;
      let b = 255;
      let vr = colMid[0];
      let vg = colMid[1];
      let vb = colMid[2];
      let va = 0;

      if (shape === 'plasma') {
        // Солнечная фотосфера: конвекционные гранулы + яркие протуберанцы
        const warp = fbm3(nx * 2.4, ny * 2.4, nz * 2.4, seed, 3) * 1.1;
        const cells = fbm3(nx * 4.5 + warp, ny * 4.5 + warp, nz * 4.5, seed + 9, 4);
        const ridge = ridged3(nx * 3.2 - warp * 0.6, ny * 3.2, nz * 3.2 + warp * 0.6, seed + 21, 3);
        const deep = mixRgb([165, 52, 10], colTrail, 0.35);
        let rgb = mixRgb(deep, colGlow, Math.pow(cells, 0.85));
        rgb = mixRgb(rgb, colMid, Math.max(0, (cells - 0.38) * 1.6));
        rgb = mixRgb(rgb, colCore, Math.pow(Math.max(0, ridge), 2.1) * 0.95 + Math.pow(cells, 3.2) * 0.7);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const wisps = Math.pow(ridged3(nx * 3.6, ny * 3.6, nz * 3.6, seed + 55, 3), 2.4);
        vr = colCore[0];
        vg = colMid[1];
        vb = colGlow[2];
        va = Math.min(255, wisps * 210);
      } else if (shape === 'frost') {
        // Морозный сапфир: ледяная глубина + острые кристаллические трещины и искры
        const base = fbm3(nx * 3.0, ny * 3.0, nz * 3.0, seed, 4);
        const cracks = Math.pow(ridged3(nx * 4.2, ny * 4.2, nz * 4.2, seed + 17, 3), 3.0);
        const facets = Math.pow(ridged3(nx * 7.5, ny * 7.5, nz * 7.5, seed + 41, 2), 4.0);
        const deepIce: [number, number, number] = [14, 58, 126];
        let rgb = mixRgb(deepIce, colGlow, base * 0.95);
        rgb = mixRgb(rgb, colMid, Math.pow(base, 1.8) * 0.85);
        rgb = mixRgb(rgb, colCore, Math.min(1, cracks * 1.35 + facets * 0.8));
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const frostVeil = Math.pow(ridged3(nx * 5.2, ny * 5.2, nz * 5.2, seed + 88, 3), 2.8);
        vr = 225;
        vg = 248;
        vb = 255;
        va = Math.min(255, frostVeil * 220);
      } else if (shape === 'quartz') {
        // Розовый кварц: шёлковый мрамор туманности + перламутрово-золотые нити
        const wx = fbm3(nx * 2.2, ny * 2.2, nz * 2.2, seed, 3) * 1.4;
        const wy = fbm3(nx * 2.2 + 4, ny * 2.2 - 3, nz * 2.2 + 2, seed + 13, 3) * 1.4;
        const silk = fbm3(nx * 2.8 + wx, ny * 2.8 + wy, nz * 2.8, seed + 29, 4);
        const pearl = Math.pow(ridged3(nx * 3.4 + wx * 0.5, ny * 3.4, nz * 3.4 + wy * 0.5, seed + 61, 3), 2.8);
        const deepRose: [number, number, number] = [96, 22, 62];
        const goldTint: [number, number, number] = [255, 228, 196];
        let rgb = mixRgb(deepRose, colGlow, silk);
        rgb = mixRgb(rgb, colMid, Math.pow(silk, 1.5) * 0.9);
        rgb = mixRgb(rgb, goldTint, pearl * 0.65);
        rgb = mixRgb(rgb, colCore, Math.pow(silk, 3.0) * 0.8 + pearl * 0.45);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const bloom = Math.pow(fbm3(nx * 3.8, ny * 3.8, nz * 3.8, seed + 93, 3), 2.2);
        vr = 255;
        vg = 212;
        vb = 232;
        va = Math.min(255, bloom * 195);
      } else if (shape === 'ring') {
        // Аврора: вертикальные ленты северного сияния от бирюзы к фиалково-мятному
        const wave = fbm3(nx * 2.6, ny * 1.3, nz * 2.6, seed, 3);
        const curtain = Math.sin((nx * 4.2 + nz * 3.6 + wave * 3.8) * Math.PI) * 0.5 + 0.5;
        const band = Math.pow(curtain, 1.8) * (0.45 + 0.55 * sinPhi);
        const deepSea: [number, number, number] = [8, 42, 58];
        const violetAurora: [number, number, number] = [138, 104, 255];
        let rgb = mixRgb(deepSea, violetAurora, Math.pow(1 - wave, 2.2) * 0.55);
        rgb = mixRgb(rgb, colGlow, wave * 0.85);
        rgb = mixRgb(rgb, colMid, band * 0.95);
        rgb = mixRgb(rgb, colCore, Math.pow(band, 2.6) * 0.9);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const shimmer = Math.pow(ridged3(nx * 3.5, ny * 1.8, nz * 3.5, seed + 71, 3), 2.6);
        vr = colCore[0];
        vg = colMid[1];
        vb = colMid[2];
        va = Math.min(255, shimmer * 205);
      } else if (shape === 'flame') {
        // Горнило: базальтовая корка + пылающие разломы лавы
        const warp = fbm3(nx * 2.5, ny * 2.5, nz * 2.5, seed, 3) * 0.9;
        const magma = Math.pow(ridged3(nx * 3.8 + warp, ny * 3.8 - warp, nz * 3.8, seed + 19, 4), 2.3);
        const crust = fbm3(nx * 5.0, ny * 5.0, nz * 5.0, seed + 43, 3);
        const basalt: [number, number, number] = [28, 10, 12];
        const crimson: [number, number, number] = [215, 28, 56];
        let rgb = mixRgb(basalt, crimson, Math.max(0, crust - 0.35) * 0.9);
        rgb = mixRgb(rgb, colGlow, Math.min(1, magma * 1.35));
        rgb = mixRgb(rgb, colMid, Math.pow(magma, 1.5) * 1.15);
        rgb = mixRgb(rgb, colCore, Math.pow(magma, 2.8) * 1.25);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const sparks = Math.pow(ridged3(nx * 4.6, ny * 4.6, nz * 4.6, seed + 83, 3), 3.1);
        vr = 255;
        vg = 165;
        vb = 72;
        va = Math.min(255, sparks * 235);
      } else if (shape === 'pulsar') {
        // Пульсар: кобальтовая нейтронная звезда + ветвистые разряды молний + яркие полюса
        const storm = fbm3(nx * 3.2, ny * 3.2, nz * 3.2, seed, 3);
        const arcs = Math.pow(ridged3(nx * 5.4 + storm, ny * 5.4, nz * 5.4 - storm, seed + 31, 4), 3.4);
        const poleCap = Math.pow(Math.abs(ny), 3.2);
        const deepBlue: [number, number, number] = [10, 26, 78];
        let rgb = mixRgb(deepBlue, colGlow, storm * 0.95);
        rgb = mixRgb(rgb, colMid, Math.min(1, arcs * 1.3 + poleCap * 0.75));
        rgb = mixRgb(rgb, colCore, Math.min(1, Math.pow(arcs, 1.6) * 1.4 + poleCap * 0.85));
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const arcVeil = Math.pow(ridged3(nx * 6.0, ny * 6.0, nz * 6.0, seed + 97, 3), 3.4);
        vr = 160;
        vg = 240;
        vb = 255;
        va = Math.min(255, arcVeil * 245);
      } else if (shape === 'void') {
        // Умбра: тёмный горизонт событий с фиолетовыми вихрями и золотисто-аметистовыми прожилками
        const swirl = fbm3(nx * 2.8, ny * 2.8, nz * 2.8, seed, 4);
        const rift = Math.pow(ridged3(nx * 4.0 + swirl, ny * 4.0, nz * 4.0 - swirl, seed + 23, 3), 3.6);
        const abyss: [number, number, number] = [8, 4, 20];
        const deepViolet: [number, number, number] = [44, 16, 92];
        const goldEdge: [number, number, number] = [255, 214, 138];
        let rgb = mixRgb(abyss, deepViolet, swirl * 0.9);
        rgb = mixRgb(rgb, colGlow, Math.pow(swirl, 2.6) * 0.65 + rift * 0.85);
        rgb = mixRgb(rgb, goldEdge, Math.pow(rift, 2.2) * 0.75);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const runeVeil = Math.pow(ridged3(nx * 4.8, ny * 4.8, nz * 4.8, seed + 67, 3), 3.2);
        vr = colMid[0];
        vg = colMid[1];
        vb = 255;
        va = Math.min(255, runeVeil * 225);
      } else {
        // Сверхновая (star): бриллиантовое сердце с радужными золотисто-бирюзовыми потоками
        const w = fbm3(nx * 2.3, ny * 2.3, nz * 2.3, seed, 3) * 1.25;
        const fusion = fbm3(nx * 3.4 + w, ny * 3.4 - w, nz * 3.4, seed + 37, 4);
        const prism = Math.pow(ridged3(nx * 4.0, ny * 4.0 + w, nz * 4.0, seed + 73, 3), 2.5);
        const warmGold: [number, number, number] = [245, 168, 52];
        const aqua: [number, number, number] = [110, 247, 216];
        const lilac: [number, number, number] = [212, 184, 255];
        let rgb = mixRgb(warmGold, aqua, Math.pow(1 - fusion, 1.8) * 0.55);
        rgb = mixRgb(rgb, lilac, Math.sin(theta * 2 + phi * 3) * 0.18 + 0.18);
        rgb = mixRgb(rgb, colMid, fusion * 0.85);
        rgb = mixRgb(rgb, colCore, Math.min(1, prism * 0.95 + Math.pow(fusion, 2.0) * 0.85));
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];

        const coronaVeil = Math.pow(ridged3(nx * 3.8, ny * 3.8, nz * 3.8, seed + 109, 3), 2.4);
        vr = 255;
        vg = 248;
        vb = 220;
        va = Math.min(255, coronaVeil * 225);
      }

      const idx = (py * W + px) * 4;
      cd[idx] = r;
      cd[idx + 1] = g;
      cd[idx + 2] = b;
      cd[idx + 3] = 255;

      vd[idx] = vr;
      vd[idx + 1] = vg;
      vd[idx + 2] = vb;
      vd[idx + 3] = va;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  vCtx.putImageData(vImg, 0, 0);
  return { coreCanvas, veilCanvas };
}

function buildCoronaCanvas(skin: Skin): HTMLCanvasElement {
  const S = 256;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  const half = S / 2;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const [cr, cg, cb] = unpackRgb(skin.core);
  const [gr, gg, gb] = unpackRgb(skin.glow);
  const [tr, tg, tb] = unpackRgb(skin.trail);

  c.clearRect(0, 0, S, S);

  if (skin.shape === 'void') {
    // Горизонт событий: тёмный центр, яркое фотонное кольцо и мягкое гало
    const g = c.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(8,4,20,0)');
    g.addColorStop(0.18, `rgba(${gr},${gg},${gb},0.18)`);
    g.addColorStop(0.28, 'rgba(255,232,190,0.92)');
    g.addColorStop(0.36, `rgba(${gr},${gg},${gb},0.75)`);
    g.addColorStop(0.64, `rgba(${tr},${tg},${tb},0.18)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  } else {
    const g = c.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(0.18, `rgba(${cr},${cg},${cb},0.78)`);
    g.addColorStop(0.42, `rgba(${gr},${gg},${gb},0.36)`);
    g.addColorStop(0.72, `rgba(${tr},${tg},${tb},0.1)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  }

  // Деликатные лучи короны по характеру скина
  const rayCount =
    skin.shape === 'frost'
      ? 6
      : skin.shape === 'pulsar'
        ? 4
        : skin.shape === 'star'
          ? 8
          : skin.shape === 'plasma' || skin.shape === 'flame'
            ? 10
            : 0;

  if (rayCount > 0) {
    c.save();
    c.translate(half, half);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2;
      const major = skin.shape === 'star' || skin.shape === 'pulsar' ? i % 2 === 0 : true;
      const len = half * (major ? 0.94 : 0.66);
      const wid = skin.shape === 'pulsar' ? 5.5 : major ? 7.5 : 4.5;
      c.save();
      c.rotate(a);
      const rg = c.createLinearGradient(0, 0, len, 0);
      rg.addColorStop(0, `rgba(${cr},${cg},${cb},${major ? 0.65 : 0.38})`);
      rg.addColorStop(0.45, `rgba(${gr},${gg},${gb},0.22)`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.beginPath();
      c.moveTo(0, -wid);
      c.lineTo(len, 0);
      c.lineTo(0, wid);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
  }

  // Тонкое дифракционное кольцо для кристальных и космических форм
  if (skin.shape === 'frost' || skin.shape === 'ring' || skin.shape === 'star' || skin.shape === 'pulsar') {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = hex(skin.mid);
    c.globalAlpha = 0.28;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(half, half, half * 0.54, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  return cvs;
}

function buildDiscCanvas(skin: Skin): HTMLCanvasElement {
  const S = 256;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  const half = S / 2;
  const [cr, cg, cb] = unpackRgb(skin.core);
  const [mr, mg, mb] = unpackRgb(skin.mid);
  const [gr, gg, gb] = unpackRgb(skin.glow);
  const img = c.createImageData(S, S);
  const d = img.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const r = Math.hypot(dx, dy);
      const idx = (y * S + x) * 4;
      if (r < 0.44 || r > 0.98) {
        d[idx + 3] = 0;
        continue;
      }
      const ang = Math.atan2(dy, dx);
      const t = (r - 0.44) / 0.54; // 0..1 по ширине кольца
      const env = Math.sin(t * Math.PI);
      let streak = 1;
      if (skin.shape === 'pulsar' || skin.shape === 'void') {
        // Спиральные рукава аккреционного диска
        const spiral = Math.sin(ang * 3 - r * 14) * 0.5 + 0.5;
        streak = 0.42 + 0.58 * Math.pow(spiral, 1.6);
      } else {
        // Концентрические дорожки колец + бегущие дуги света
        const bands = 0.55 + 0.45 * Math.sin(t * Math.PI * 5);
        const arc = 0.55 + 0.45 * Math.pow(Math.sin(ang * 2) * 0.5 + 0.5, 2);
        streak = bands * arc;
      }
      const alpha = Math.max(0, Math.min(1, env * streak * 0.95));
      const hot = Math.pow(1 - Math.abs(t - 0.35) * 1.6, 2);
      const rgb = mixRgb([gr, gg, gb], hot > 0.45 ? [cr, cg, cb] : [mr, mg, mb], Math.max(0, hot));
      d[idx] = rgb[0];
      d[idx + 1] = rgb[1];
      d[idx + 2] = rgb[2];
      d[idx + 3] = Math.round(alpha * 255);
    }
  }
  c.putImageData(img, 0, 0);
  return cvs;
}

function buildFlameCanvas(skin: Skin): HTMLCanvasElement {
  const W = 128;
  const H = 128;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const c = cvs.getContext('2d')!;
  const [cr, cg, cb] = unpackRgb(skin.core);
  const [mr, mg, mb] = unpackRgb(skin.mid);
  const [tr, tg, tb] = unpackRgb(skin.trail);
  const img = c.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 = вершина хвоста, 1 = основание у ядра
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const tongues = Math.sin(u * Math.PI * 2 * 5 + v * 7) * 0.5 + 0.5;
      const fade = Math.pow(v, 1.55) * (0.38 + 0.62 * Math.pow(tongues, 1.4));
      const idx = (y * W + x) * 4;
      const rgb = v > 0.62 ? mixRgb([mr, mg, mb], [cr, cg, cb], (v - 0.62) / 0.38) : mixRgb([tr, tg, tb], [mr, mg, mb], v / 0.62);
      d[idx] = rgb[0];
      d[idx + 1] = rgb[1];
      d[idx + 2] = rgb[2];
      d[idx + 3] = Math.round(Math.max(0, Math.min(1, fade)) * 235);
    }
  }
  c.putImageData(img, 0, 0);
  return cvs;
}

function getBundle(skin: Skin): SkinTexBundle {
  let b = texCache.get(skin.id);
  if (b) return b;

  const { coreCanvas, veilCanvas } = buildCoreAndVeilCanvases(skin);
  const coreTex = new THREE.CanvasTexture(coreCanvas);
  coreTex.colorSpace = THREE.SRGBColorSpace;
  coreTex.wrapS = THREE.RepeatWrapping;
  coreTex.wrapT = THREE.ClampToEdgeWrapping;

  const veilTex = new THREE.CanvasTexture(veilCanvas);
  veilTex.colorSpace = THREE.SRGBColorSpace;
  veilTex.wrapS = THREE.RepeatWrapping;
  veilTex.wrapT = THREE.ClampToEdgeWrapping;

  const coronaTex = new THREE.CanvasTexture(buildCoronaCanvas(skin));
  coronaTex.colorSpace = THREE.SRGBColorSpace;

  const discTex = new THREE.CanvasTexture(buildDiscCanvas(skin));
  discTex.colorSpace = THREE.SRGBColorSpace;

  const flameTex = new THREE.CanvasTexture(buildFlameCanvas(skin));
  flameTex.colorSpace = THREE.SRGBColorSpace;
  flameTex.wrapS = THREE.RepeatWrapping;

  b = { coreCanvas, coreTex, veilTex, coronaTex, discTex, flameTex };
  texCache.set(skin.id, b);
  return b;
}

// ---------------- Общие геометрии для 3D-искры (ноль утечек GPU) ----------------

let sharedGeos: {
  coreSphere: THREE.SphereGeometry;
  veilSphere: THREE.SphereGeometry;
  discPlane: THREE.PlaneGeometry;
  thinRingA: THREE.TorusGeometry;
  thinRingB: THREE.TorusGeometry;
  moonSphere: THREE.SphereGeometry;
  flameConeA: THREE.ConeGeometry;
  flameConeB: THREE.ConeGeometry;
  jetCone: THREE.CylinderGeometry;
  voidCageOuter: THREE.IcosahedronGeometry;
  voidCageInner: THREE.OctahedronGeometry;
  starSpike: THREE.OctahedronGeometry;
} | null = null;

function geos() {
  if (!sharedGeos) {
    sharedGeos = {
      coreSphere: new THREE.SphereGeometry(0.35, 32, 24),
      veilSphere: new THREE.SphereGeometry(0.405, 28, 20),
      discPlane: new THREE.PlaneGeometry(1.48, 1.48),
      thinRingA: new THREE.TorusGeometry(0.62, 0.022, 8, 48),
      thinRingB: new THREE.TorusGeometry(0.76, 0.014, 6, 48),
      moonSphere: new THREE.SphereGeometry(0.068, 12, 10),
      flameConeA: new THREE.ConeGeometry(0.39, 1.05, 20, 1, true),
      flameConeB: new THREE.ConeGeometry(0.28, 0.78, 16, 1, true),
      jetCone: new THREE.CylinderGeometry(0.02, 0.13, 1.05, 12, 1, true),
      voidCageOuter: new THREE.IcosahedronGeometry(0.56, 0),
      voidCageInner: new THREE.OctahedronGeometry(0.45, 0),
      starSpike: new THREE.OctahedronGeometry(0.11, 0),
    };
  }
  return sharedGeos;
}

export interface SparkRig {
  group: THREE.Group;
  coronaTex: THREE.Texture;
  shape: SparkShape;
  update: (dt: number, time: number, lightK: number, speedK: number) => void;
  dispose: () => void;
}

export function buildSparkRig(skin: Skin): SparkRig {
  const bundle = getBundle(skin);
  const g = geos();
  const root = new THREE.Group();
  const mats: THREE.Material[] = [];

  // 1. Внутреннее текстурированное ядро
  const coreMat = new THREE.MeshBasicMaterial({ map: bundle.coreTex });
  mats.push(coreMat);
  const coreMesh = new THREE.Mesh(g.coreSphere, coreMat);
  root.add(coreMesh);

  // 2. Встречно-вращающаяся энергетическая вуаль (придаёт живую 3D-глубину)
  const veilMat = new THREE.MeshBasicMaterial({
    map: bundle.veilTex,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mats.push(veilMat);
  const veilMesh = new THREE.Mesh(g.veilSphere, veilMat);
  root.add(veilMesh);

  // Дополнительные архитектурные элементы платных и тематических форм
  let ringPivotA: THREE.Group | null = null;
  let ringPivotB: THREE.Group | null = null;
  let flameA: THREE.Mesh | null = null;
  let flameB: THREE.Mesh | null = null;
  let pulsarPivot: THREE.Group | null = null;
  let jetMat: THREE.MeshBasicMaterial | null = null;
  let voidOuter: THREE.Mesh | null = null;
  let voidInner: THREE.Mesh | null = null;
  let starCrown: THREE.Group | null = null;
  let starHalo: THREE.Mesh | null = null;
  let frostHalo: THREE.Mesh | null = null;

  if (skin.shape === 'frost') {
    // Тонкое морозное гало вокруг ледяного кристалла
    const hMat = new THREE.MeshBasicMaterial({
      color: skin.mid,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    mats.push(hMat);
    frostHalo = new THREE.Mesh(g.thinRingA, hMat);
    frostHalo.scale.setScalar(0.84);
    frostHalo.rotation.x = Math.PI / 2.4;
    root.add(frostHalo);
  } else if (skin.shape === 'ring') {
    // Аврора: текстурированный орбитальный диск + встречное кольцо со спутниками
    ringPivotA = new THREE.Group();
    ringPivotA.rotation.set(Math.PI / 2.5, 0.22, 0);
    const discMat = new THREE.MeshBasicMaterial({
      map: bundle.discTex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rimMat = new THREE.MeshBasicMaterial({
      color: skin.core,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const moonMat = new THREE.MeshBasicMaterial({ color: skin.core });
    const moonGlowMat = new THREE.SpriteMaterial({
      map: bundle.coronaTex,
      color: skin.mid,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    mats.push(discMat, rimMat, moonMat, moonGlowMat);

    const disc = new THREE.Mesh(g.discPlane, discMat);
    const rim = new THREE.Mesh(g.thinRingA, rimMat);
    const moon1 = new THREE.Mesh(g.moonSphere, moonMat);
    moon1.position.set(0.62, 0, 0);
    const mg1 = new THREE.Sprite(moonGlowMat);
    mg1.scale.setScalar(0.42);
    moon1.add(mg1);
    ringPivotA.add(disc, rim, moon1);

    ringPivotB = new THREE.Group();
    ringPivotB.rotation.set(-Math.PI / 2.9, -0.38, 0.4);
    const rim2Mat = new THREE.MeshBasicMaterial({
      color: skin.glow,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    mats.push(rim2Mat);
    const rim2 = new THREE.Mesh(g.thinRingB, rim2Mat);
    const moon2 = new THREE.Mesh(g.moonSphere, moonMat);
    moon2.scale.setScalar(0.75);
    moon2.position.set(-0.76, 0, 0);
    ringPivotB.add(rim2, moon2);

    root.add(ringPivotA, ringPivotB);
  } else if (skin.shape === 'flame') {
    // Горнило: двойная вихревая текстурированная корона пламени кометы
    const fMatA = new THREE.MeshBasicMaterial({
      map: bundle.flameTex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fMatB = new THREE.MeshBasicMaterial({
      map: bundle.flameTex,
      color: skin.core,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mats.push(fMatA, fMatB);
    flameA = new THREE.Mesh(g.flameConeA, fMatA);
    flameA.rotation.x = Math.PI / 2;
    flameA.position.z = 0.46;
    flameB = new THREE.Mesh(g.flameConeB, fMatB);
    flameB.rotation.x = Math.PI / 2;
    flameB.position.z = 0.34;
    root.add(flameA, flameB);
  } else if (skin.shape === 'pulsar') {
    // Пульсар: наклонный спиральный аккреционный диск + два релятивистских джета с полюсов
    pulsarPivot = new THREE.Group();
    pulsarPivot.rotation.set(0.38, 0, 0.48);

    const discMat = new THREE.MeshBasicMaterial({
      map: bundle.discTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    jetMat = new THREE.MeshBasicMaterial({
      color: skin.mid,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const eqMat = new THREE.MeshBasicMaterial({
      color: skin.core,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    mats.push(discMat, jetMat, eqMat);

    const disc = new THREE.Mesh(g.discPlane, discMat);
    disc.rotation.x = Math.PI / 2;
    const eqRing = new THREE.Mesh(g.thinRingA, eqMat);
    eqRing.rotation.x = Math.PI / 2;
    eqRing.scale.setScalar(0.92);

    const jetTop = new THREE.Mesh(g.jetCone, jetMat);
    jetTop.position.y = 0.72;
    const jetBot = new THREE.Mesh(g.jetCone, jetMat);
    jetBot.rotation.z = Math.PI;
    jetBot.position.y = -0.72;

    pulsarPivot.add(disc, eqRing, jetTop, jetBot);
    root.add(pulsarPivot);
  } else if (skin.shape === 'void') {
    // Умбра: тёмная сингулярность + двойной рунический гео-каркас + гравитационный диск
    coreMesh.scale.setScalar(0.88);
    veilMesh.scale.setScalar(0.92);

    const outerMat = new THREE.MeshBasicMaterial({
      color: skin.mid,
      wireframe: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffdfa0,
      wireframe: true,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lensMat = new THREE.MeshBasicMaterial({
      map: bundle.discTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mats.push(outerMat, innerMat, lensMat);

    voidOuter = new THREE.Mesh(g.voidCageOuter, outerMat);
    voidInner = new THREE.Mesh(g.voidCageInner, innerMat);
    const lensDisc = new THREE.Mesh(g.discPlane, lensMat);
    lensDisc.scale.setScalar(0.92);
    lensDisc.rotation.set(Math.PI / 2.6, 0.25, 0);
    ringPivotA = new THREE.Group();
    ringPivotA.add(lensDisc);
    root.add(voidOuter, voidInner, ringPivotA);
  } else if (skin.shape === 'star') {
    // Сверхновая: кристаллическая 6-лучевая звёздная корона + двойной радужный нимб
    starCrown = new THREE.Group();
    const spikeMatA = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spikeMatB = new THREE.MeshBasicMaterial({
      color: 0x6ef7d8,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      map: bundle.discTex,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mats.push(spikeMatA, spikeMatB, haloMat);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = new THREE.Mesh(g.starSpike, i % 2 === 0 ? spikeMatA : spikeMatB);
      const len = i % 2 === 0 ? 2.5 : 1.85;
      sp.scale.set(0.68, len, 0.68);
      sp.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0);
      sp.rotation.z = a - Math.PI / 2;
      starCrown.add(sp);
    }
    starHalo = new THREE.Mesh(g.discPlane, haloMat);
    starHalo.scale.setScalar(1.06);
    starHalo.rotation.set(Math.PI / 2.5, -0.25, 0);
    root.add(starCrown, starHalo);
  }

  return {
    group: root,
    coronaTex: bundle.coronaTex,
    shape: skin.shape,
    update(dt: number, time: number, lightK: number, speedK: number) {
      const lum = skin.shape === 'void' ? 0.68 + lightK * 0.32 : 0.56 + lightK * 0.44;
      coreMat.color.setScalar(lum);
      veilMat.opacity = (0.42 + lightK * 0.42) * (0.88 + Math.sin(time * 3.4) * 0.12);

      // Плавное встречное вращение двух текстурных сфер создаёт живую объёмную плазму
      coreMesh.rotation.y += dt * (0.85 + speedK * 0.55);
      coreMesh.rotation.x = Math.sin(time * 0.9) * 0.22;
      veilMesh.rotation.y -= dt * (1.25 + speedK * 0.7);
      veilMesh.rotation.z += dt * 0.55;

      const pulse = 1 + Math.sin(time * 4.2) * 0.035;
      coreMesh.scale.setScalar((skin.shape === 'void' ? 0.88 : 1) * pulse);

      if (frostHalo) {
        frostHalo.rotation.z += dt * 1.4;
        frostHalo.rotation.y = Math.sin(time * 1.3) * 0.35;
      }
      if (ringPivotA) {
        ringPivotA.rotation.z += dt * 2.1;
      }
      if (ringPivotB) {
        ringPivotB.rotation.z -= dt * 1.55;
      }
      if (flameA && flameB) {
        const f1 = 1 + Math.sin(time * 19) * 0.1;
        const f2 = 1 + Math.cos(time * 24) * 0.12;
        flameA.rotation.y += dt * 3.8;
        flameB.rotation.y -= dt * 5.2;
        flameA.scale.set(f1, 1 + speedK * 0.35 + (f1 - 1) * 1.2, f1);
        flameB.scale.set(f2, 1 + speedK * 0.28, f2);
      }
      if (pulsarPivot) {
        pulsarPivot.rotation.y += dt * 3.4;
        pulsarPivot.rotation.z = 0.48 + Math.sin(time * 2.2) * 0.18;
        if (jetMat) jetMat.opacity = 0.45 + Math.abs(Math.sin(time * 9)) * 0.42;
      }
      if (voidOuter && voidInner) {
        voidOuter.rotation.x += dt * 1.1;
        voidOuter.rotation.y += dt * 1.65;
        voidInner.rotation.x -= dt * 1.9;
        voidInner.rotation.z += dt * 1.4;
        const vp = 1 + Math.sin(time * 4.8) * 0.055;
        voidOuter.scale.setScalar(vp);
      }
      if (starCrown && starHalo) {
        starCrown.rotation.z += dt * 1.35;
        starCrown.scale.setScalar(1 + Math.sin(time * 6.5) * 0.075);
        starHalo.rotation.z -= dt * 1.8;
      }
    },
    dispose() {
      for (const m of mats) m.dispose();
    },
  };
}

// ---------------- Высокодетализированное 2D-превью скина для Магазина и Меню ----------------

export function getSkinPreviewUrl(skinId: string): string {
  const cached = previewCache.get(skinId);
  if (cached) return cached;

  const skin = skinById(skinId);
  const bundle = getBundle(skin);
  const S = 144;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  const cx = S / 2;
  const cy = S / 2;
  const R = 36;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

  // 1. Корона / сияние на заднем плане
  c.drawImage(bundle.coronaTex.image as HTMLCanvasElement, 0, 0, S, S);

  // Задние архитектурные детали (пламя, джеты, лучи короны)
  c.save();
  c.translate(cx, cy);
  if (skin.shape === 'flame') {
    const fg = c.createLinearGradient(0, -R * 1.45, 0, R * 0.8);
    fg.addColorStop(0, 'rgba(255,41,104,0)');
    fg.addColorStop(0.45, 'rgba(255,90,36,0.72)');
    fg.addColorStop(1, 'rgba(255,240,212,0.95)');
    c.fillStyle = fg;
    for (const rot of [-0.22, 0, 0.22]) {
      c.save();
      c.rotate(rot);
      c.beginPath();
      c.moveTo(-R * 0.72, R * 0.1);
      c.quadraticCurveTo(-R * 0.25, -R * 1.55, 0, -R * 1.62);
      c.quadraticCurveTo(R * 0.25, -R * 1.55, R * 0.72, R * 0.1);
      c.closePath();
      c.fill();
      c.restore();
    }
  } else if (skin.shape === 'pulsar') {
    c.save();
    c.rotate(-0.48);
    const jg = c.createLinearGradient(0, -R * 1.75, 0, R * 1.75);
    jg.addColorStop(0, 'rgba(92,225,255,0)');
    jg.addColorStop(0.35, 'rgba(92,225,255,0.85)');
    jg.addColorStop(0.5, 'rgba(255,255,255,1)');
    jg.addColorStop(0.65, 'rgba(92,225,255,0.85)');
    jg.addColorStop(1, 'rgba(92,225,255,0)');
    c.fillStyle = jg;
    c.beginPath();
    c.moveTo(-4, -R * 1.75);
    c.lineTo(4, -R * 1.75);
    c.lineTo(8, 0);
    c.lineTo(4, R * 1.75);
    c.lineTo(-4, R * 1.75);
    c.lineTo(-8, 0);
    c.closePath();
    c.fill();
    c.restore();
  } else if (skin.shape === 'star') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const len = i % 2 === 0 ? R * 1.62 : R * 1.32;
      c.save();
      c.rotate(a);
      c.fillStyle = i % 2 === 0 ? '#ffffff' : '#6ef7d8';
      c.globalAlpha = 0.88;
      c.beginPath();
      c.moveTo(0, -5.5);
      c.lineTo(len, 0);
      c.lineTo(0, 5.5);
      c.closePath();
      c.fill();
      c.restore();
    }
  }
  c.restore();

  // Задняя дуга орбиты (для ring / pulsar / void / star)
  const hasOrbit = skin.shape === 'ring' || skin.shape === 'pulsar' || skin.shape === 'void' || skin.shape === 'star';
  const orbitTilt = skin.shape === 'pulsar' ? -0.48 : -0.32;
  if (hasOrbit) {
    c.save();
    c.translate(cx, cy);
    c.rotate(orbitTilt);
    c.strokeStyle = hex(skin.mid);
    c.lineWidth = skin.shape === 'ring' ? 5.5 : 4;
    c.globalAlpha = 0.68;
    c.beginPath();
    c.ellipse(0, 0, R * 1.56, R * 0.48, 0, Math.PI, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // 2. Рендер текстурированного 3D-шара с объёмным освещением и бликом
  const srcCtx = bundle.coreCanvas.getContext('2d')!;
  const tw = bundle.coreCanvas.width;
  const th = bundle.coreCanvas.height;
  const src = srcCtx.getImageData(0, 0, tw, th).data;

  const sphereBox = R * 2 + 2;
  const sx0 = Math.floor(cx - R - 1);
  const sy0 = Math.floor(cy - R - 1);
  const sphereCanvas = document.createElement('canvas');
  sphereCanvas.width = sphereBox;
  sphereCanvas.height = sphereBox;
  const spCtx = sphereCanvas.getContext('2d')!;
  const spImg = spCtx.createImageData(sphereBox, sphereBox);
  const sd = spImg.data;
  const [rr, rg, rb] = unpackRgb(skin.mid);
  const sphereR = skin.shape === 'void' ? R * 0.86 : R;

  for (let py = 0; py < sphereBox; py++) {
    for (let px = 0; px < sphereBox; px++) {
      const dx = (px + sx0 + 0.5 - cx) / sphereR;
      const dy = (py + sy0 + 0.5 - cy) / sphereR;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1) continue;
      const dz = Math.sqrt(1 - r2);
      const u = ((Math.atan2(dx, dz) / (Math.PI * 2)) + 0.5) % 1;
      const v = Math.acos(Math.max(-1, Math.min(1, -dy))) / Math.PI;
      const tx = Math.min(tw - 1, Math.floor(u * tw));
      const ty = Math.min(th - 1, Math.floor(v * th));
      const si = (ty * tw + tx) * 4;

      // Мягкое сферическое освещение + яркий rim-light по краю + блик
      const ndotl = Math.max(0, -dx * 0.38 - dy * 0.42 + dz * 0.82);
      const rim = Math.pow(1 - dz, 2.2);
      const spec = Math.pow(Math.max(0, -dx * 0.42 - dy * 0.48 + dz * 0.77), 26);
      const shade = skin.shape === 'void' ? 0.55 + ndotl * 0.55 : 0.62 + ndotl * 0.58;

      let cr2 = src[si] * shade + rr * rim * 0.65 + 255 * spec * 0.65;
      let cg2 = src[si + 1] * shade + rg * rim * 0.65 + 255 * spec * 0.65;
      let cb2 = src[si + 2] * shade + rb * rim * 0.65 + 255 * spec * 0.65;

      // Мягкое сглаживание кромки сферы (anti-aliasing)
      const edgeDist = (1 - Math.sqrt(r2)) * sphereR;
      const alpha = Math.max(0, Math.min(1, edgeDist * 1.3));

      const di = (py * sphereBox + px) * 4;
      sd[di] = Math.min(255, cr2);
      sd[di + 1] = Math.min(255, cg2);
      sd[di + 2] = Math.min(255, cb2);
      sd[di + 3] = Math.round(alpha * 255);
    }
  }
  spCtx.putImageData(spImg, 0, 0);
  c.drawImage(sphereCanvas, sx0, sy0);

  // 3. Передние детали (передняя дуга орбиты, спутники, каркас Умбры, морозная грань)
  if (hasOrbit) {
    c.save();
    c.translate(cx, cy);
    c.rotate(orbitTilt);
    c.strokeStyle = hex(skin.core);
    c.shadowColor = hex(skin.glow);
    c.shadowBlur = 10;
    c.lineWidth = skin.shape === 'ring' ? 5.5 : 4;
    c.globalAlpha = 0.92;
    c.beginPath();
    c.ellipse(0, 0, R * 1.56, R * 0.48, 0, 0, Math.PI);
    c.stroke();

    if (skin.shape === 'ring') {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(R * 1.28, R * 0.26, 4.8, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  if (skin.shape === 'void') {
    // Рунический гео-каркас поверх горизонта событий
    c.save();
    c.translate(cx, cy);
    c.strokeStyle = hex(skin.mid);
    c.lineWidth = 1.8;
    c.globalAlpha = 0.85;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * R * 1.18;
      const py = Math.sin(a) * R * 1.18;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.stroke();
    c.strokeStyle = '#ffe2a8';
    c.globalAlpha = 0.55;
    c.beginPath();
    for (let i = 0; i < 6; i += 2) {
      const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const a2 = (((i + 2) % 6) / 6) * Math.PI * 2 - Math.PI / 2;
      c.moveTo(Math.cos(a1) * R * 1.18, Math.sin(a1) * R * 1.18);
      c.lineTo(Math.cos(a2) * R * 1.18, Math.sin(a2) * R * 1.18);
    }
    c.stroke();
    c.restore();
  }

  const url = cvs.toDataURL('image/png');
  previewCache.set(skinId, url);
  return url;
}
