// Экономика LUMEN: одна валюта (✦ искры). Копишь игрой — или докупаешь за рубли.
// Призмы, ящики и сезон убраны: ничего, что нельзя понять за 5 секунд.

import { TUNNEL_LOOKS, type TunnelLook, type WallPalette } from './tunnels';

export interface Theme {
  id: string;
  name: string;
  desc: string;
  price: number; // ✦, 0 = бесплатно
  rich: number; // 0..1 — яркость космоса за стенами (звёзды, туманности, планеты)
  warm?: boolean; // тёплая/розовая обшивка: препятствия рисуются холодным льдисто-белым, чтобы не сливаться
  sky: string;
  fog: number;
  wall: WallPalette;
  look: TunnelLook; // архитектура: ритм рёбер, свет, ядро, частицы
  ringsHue: number;
  stars: number;
  starBright: number;
  nebula: number;
  beam: number;
  strut: number;
  runway: number;
  rail: number;
  planets: { color: number; emissive: number; x: number; y: number; z: number; r: number }[];
  accent: string;
  sonar: string;
}

// Планеты за иллюминаторами — общий набор, цвета подстраиваются под тоннель.
const mkPlanets = (a: [number, number], b: [number, number], c: [number, number]): Theme['planets'] => [
  { color: a[0], emissive: a[1], x: 104, y: 54, z: -190, r: 26 },
  { color: b[0], emissive: b[1], x: -96, y: -58, z: -128, r: 15 },
  { color: c[0], emissive: c[1], x: -40, y: 108, z: -300, r: 40 },
];

export const THEMES: Theme[] = [
  // ---------- Бесплатные (3): спокойная база ----------
  {
    id: 'pulse',
    name: 'Холодный импульс',
    desc: 'Чистый футуристичный тоннель: холодный синий свет, аккуратные рёбра и умеренное свечение.',
    price: 0,
    rich: 0.45,
    sky: '#050814',
    fog: 0x050814,
    wall: { a: '#14234a', b: '#1c3466', c: '#0a1230', seam: '#050a1a', cool: '#6fd0ff', warm: '#b9ecff', dark: '#070d20', glass: '#cfeaff' },
    look: TUNNEL_LOOKS.pulse,
    ringsHue: 0.58,
    stars: 0xc9dbff,
    starBright: 0xfff0d0,
    nebula: 0x2b4fc0,
    beam: 0x5fb4ff,
    strut: 0x2f4f9a,
    runway: 0x9fd4ff,
    rail: 0x6fe3ff,
    planets: mkPlanets([0x3a6bd8, 0x101c4a], [0xd86a3a, 0x4a1408], [0x6c3ad8, 0x1a0a44]),
    accent: '#6fd0ff',
    sonar: '#6ef7d8',
  },
  {
    id: 'copper',
    name: 'Медные кольца',
    desc: 'Тёмный металл, тёплые янтарные сегменты и редкие световые метки. Препятствия здесь холодные.',
    price: 0,
    rich: 0.4,
    warm: true,
    sky: '#0c0805',
    fog: 0x0c0805,
    wall: { a: '#241a14', b: '#33241a', c: '#120c09', seam: '#060403', cool: '#ffb347', warm: '#ffd89a', dark: '#0e0907', glass: '#ffd9a0' },
    look: TUNNEL_LOOKS.copper,
    ringsHue: 0.08,
    stars: 0xffe0a8,
    starBright: 0xffffff,
    nebula: 0x6b3a12,
    beam: 0xd98a2b,
    strut: 0x6b4423,
    runway: 0xffc678,
    rail: 0xff9a3a,
    planets: mkPlanets([0xff7a2f, 0x7c2604], [0xffd166, 0x8a5c05], [0xe03c18, 0x4a0d04]),
    accent: '#ffb347',
    sonar: '#ffc678',
  },
  {
    id: 'polar',
    name: 'Полярная глубина',
    desc: 'Глубокий сине-зелёный градиент, мягкое сияние и лёгкие частицы в толще воды.',
    price: 0,
    rich: 0.5,
    sky: '#031319',
    fog: 0x031319,
    wall: { a: '#0b3a48', b: '#0f5560', c: '#06222c', seam: '#021016', cool: '#7ff3dc', warm: '#a8ffe8', dark: '#04202a', glass: '#d2fff6' },
    look: TUNNEL_LOOKS.polar,
    ringsHue: 0.5,
    stars: 0xa9fff0,
    starBright: 0xffffff,
    nebula: 0x108a9a,
    beam: 0x3fe0c8,
    strut: 0x1c6a7a,
    runway: 0x8affea,
    rail: 0x7fd8ff,
    planets: mkPlanets([0x2ad0c0, 0x06463f], [0x7a5cff, 0x221055], [0x1fa0d8, 0x052b45]),
    accent: '#5ff0d4',
    sonar: '#7ff3dc',
  },
  // ---------- Платные (5): нарастающая выразительность ----------
  {
    id: 'current',
    name: 'Подводное течение',
    desc: 'Стеклянно-металлические рёбра, бирюзовый свет, ощущение глубины и редкие световые частицы.',
    price: 900,
    rich: 0.5,
    sky: '#021417',
    fog: 0x021417,
    wall: { a: '#0c4650', b: '#14707a', c: '#052a32', seam: '#020f13', cool: '#40f0e0', warm: '#9ffcf0', dark: '#04222a', glass: '#d4fffa' },
    look: TUNNEL_LOOKS.current,
    ringsHue: 0.49,
    stars: 0xbffcf0,
    starBright: 0xffffff,
    nebula: 0x0ea8be,
    beam: 0x30e0d0,
    strut: 0x1a7a86,
    runway: 0x7ffff0,
    rail: 0x40e8ff,
    planets: mkPlanets([0x2ad0c0, 0x08584f], [0xffd166, 0x6a4a08], [0xbffcf0, 0x1e5c54]),
    accent: '#40f0e0',
    sonar: '#8affea',
  },
  {
    id: 'prism',
    name: 'Призматический сон',
    desc: 'Переливающиеся грани, розово-фиолетовый свет и чистые яркие акценты. Препятствия — ледяные.',
    price: 1400,
    rich: 0.55,
    warm: true,
    sky: '#0d0620',
    fog: 0x0d0620,
    wall: { a: '#3a1f5e', b: '#5a2f86', c: '#1c0d38', seam: '#0a0418', cool: '#ff7ad9', warm: '#b69cff', dark: '#150a2c', glass: '#ffd6f6' },
    look: TUNNEL_LOOKS.prism,
    ringsHue: 0.84,
    stars: 0xf2dcff,
    starBright: 0xffffff,
    nebula: 0xb03cd8,
    beam: 0xff7ad9,
    strut: 0x7b4cc8,
    runway: 0xffc2f0,
    rail: 0xc9a0ff,
    planets: mkPlanets([0xa670ff, 0x361478], [0xff9ad8, 0x681248], [0xf2d6ff, 0x522e7c]),
    accent: '#ff8ae0',
    sonar: '#e9b8ff',
  },
  {
    id: 'corona',
    name: 'Солнечная корона',
    desc: 'Золотые сегменты, тёмная бронза, яркий центр и мягкие лучи. Препятствия — холодные.',
    price: 1900,
    rich: 0.55,
    warm: true,
    sky: '#120802',
    fog: 0x120802,
    wall: { a: '#2a180a', b: '#3d2410', c: '#140a04', seam: '#080301', cool: '#ffd35a', warm: '#fff0b0', dark: '#100602', glass: '#ffe8a8' },
    look: TUNNEL_LOOKS.corona,
    ringsHue: 0.12,
    stars: 0xfff2cf,
    starBright: 0xffffff,
    nebula: 0xd88a10,
    beam: 0xffc43a,
    strut: 0x8a5a1c,
    runway: 0xffe6a0,
    rail: 0xffb020,
    planets: mkPlanets([0xffd166, 0x7c5605], [0xff7a2f, 0x7c2604], [0xffe9b8, 0x7a6009]),
    accent: '#ffd35a',
    sonar: '#ffe08a',
  },
  {
    id: 'crystal',
    name: 'Кристальный разлом',
    desc: 'Кристаллические панели, ледяные блики и контрастные тёмные промежутки между гранями.',
    price: 2600,
    rich: 0.55,
    sky: '#040a18',
    fog: 0x040a18,
    wall: { a: '#1d3a66', b: '#3a6aa0', c: '#0b1a36', seam: '#02060f', cool: '#bfe6ff', warm: '#ffffff', dark: '#050c1a', glass: '#eaf8ff' },
    look: TUNNEL_LOOKS.crystal,
    ringsHue: 0.57,
    stars: 0xe8f6ff,
    starBright: 0xbcd0ff,
    nebula: 0x3a7ac8,
    beam: 0xaee0ff,
    strut: 0x3a6a9a,
    runway: 0xe0f4ff,
    rail: 0x9fd8ff,
    planets: mkPlanets([0xbfe4ff, 0x1d3f5e], [0x6a8fd8, 0x101f46], [0xdff2ff, 0x24455e]),
    accent: '#bfe6ff',
    sonar: '#d4f6ff',
  },
  {
    id: 'zero',
    name: 'Нулевая точка',
    desc: 'Премиальный обсидиановый тоннель: глянцевые плиты со спектральной инкрустацией, переливающиеся рёбра и сингулярность с кольцом аккреции в конце пути.',
    price: 3400,
    rich: 0.3,
    sky: '#010103',
    fog: 0x010104,
    wall: { a: '#0d0f1e', b: '#171b32', c: '#030409', seam: '#010102', cool: '#e6eeff', warm: '#ffffff', dark: '#030308', glass: '#ffffff' },
    look: TUNNEL_LOOKS.zero,
    ringsHue: 0.62,
    stars: 0xe6eeff,
    starBright: 0xffffff,
    nebula: 0x3a2a7a,
    beam: 0xb8c8ff,
    strut: 0x3a4272,
    runway: 0xe8f0ff,
    rail: 0xffffff,
    planets: mkPlanets([0x2a2a6a, 0x0a0c26], [0x3a2a5a, 0x120a22], [0x182050, 0x060816]),
    accent: '#e6eeff',
    sonar: '#ffffff',
  },
];

/** Старые id тоннелей (до обновления линейки) → новые, по месту в линейке и цене. */
export const LEGACY_THEME_IDS: Record<string, string> = {
  void: 'pulse',
  tidal: 'copper',
  glacier: 'polar',
  reactor: 'current',
  crimson: 'prism',
  silk: 'corona',
  quantum: 'crystal',
  nova: 'zero',
};

export const FREE_THEME_IDS = ['pulse', 'copper', 'polar'];

export function migrateThemeId(id: string): string {
  return LEGACY_THEME_IDS[id] ?? id;
}

export function themeById(id: string): Theme {
  const k = migrateThemeId(id);
  return THEMES.find((t) => t.id === k) ?? THEMES[0];
}

// ---------------- Расходники (баффы на забег) ----------------
export interface LoadoutFx {
  startShield: boolean;
  extraMagnet: number;
  orbLight: number;
  warden: boolean;
  scoreMult: number;
}

export interface BuffDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  fx: Partial<LoadoutFx>;
}

export const BUFFS: BuffDef[] = [
  { id: 'shield', name: 'Щит на старте', desc: 'Первый осколок поглощается без потерь.', price: 90, fx: { startShield: true } },
  { id: 'magnet', name: 'Расширитель магнита', desc: 'Магнит в этом забеге держится +4.7 секунды.', price: 75, fx: { extraMagnet: 4.7 } },
  { id: 'cells', name: 'Светлячки-дозаправщики', desc: 'Свет от сборки +27%.', price: 120, fx: { orbLight: 1.27 } },
  { id: 'warden', name: 'Пепельный оберег', desc: 'Первый удар не сбрасывает комбо и не гасит свет.', price: 150, fx: { warden: true } },
  { id: 'charm', name: 'Талисман потока', desc: '+13% очков за всё в этом забеге.', price: 135, fx: { scoreMult: 1.13 } },
];

export function buffById(id: string): BuffDef | undefined {
  return BUFFS.find((b) => b.id === id);
}

export function fxFromLoadout(ids: string[]): LoadoutFx {
  const fx: LoadoutFx = { startShield: false, extraMagnet: 0, orbLight: 1, warden: false, scoreMult: 1 };
  for (const id of ids) {
    const b = buffById(id);
    if (!b) continue;
    if (b.fx.startShield) fx.startShield = true;
    fx.extraMagnet += b.fx.extraMagnet ?? 0;
    fx.orbLight *= b.fx.orbLight ?? 1;
    fx.scoreMult *= b.fx.scoreMult ?? 1;
    if (b.fx.warden) fx.warden = true;
  }
  return fx;
}

export function emptyFx(): LoadoutFx {
  return { startShield: false, extraMagnet: 0, orbLight: 1, warden: false, scoreMult: 1 };
}

// ---------------- Достижения ----------------
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  target: number;
  stat: 'runs' | 'totalOrbs' | 'totalDist' | 'totalNear' | 'bestCombo' | 'owned' | 'themes';
  sparks: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'Первый полёт', desc: 'Завершить 1 забег', target: 1, stat: 'runs', sparks: 40 },
  { id: 'flyer', name: 'Намотка', desc: 'Пролететь 8 000 м суммарно', target: 8000, stat: 'totalDist', sparks: 120 },
  { id: 'collector', name: 'Светоколлектор', desc: 'Собрать 200 светлячков', target: 200, stat: 'totalOrbs', sparks: 160 },
  { id: 'dare', name: 'Впритирку', desc: '150 опасных проходов рядом', target: 150, stat: 'totalNear', sparks: 180 },
  { id: 'combo', name: 'В потоке', desc: 'Держать комбо ×10', target: 10, stat: 'bestCombo', sparks: 200 },
  { id: 'wardrobe', name: 'Гардероб', desc: 'Владеть 4 скинами', target: 4, stat: 'owned', sparks: 250 },
  { id: 'designer', name: 'Дизайнер тоннеля', desc: 'Открыть 4 тоннеля', target: 4, stat: 'themes', sparks: 300 },
  { id: 'veteran', name: 'Ветеран тоннеля', desc: '50 забегов', target: 50, stat: 'runs', sparks: 400 },
];

// ---------------- Покупки за рубли (SKU площадки) ----------------
export type SkuKind = 'sparks' | 'bundle' | 'noads';

export interface Product {
  id: string;
  title: string;
  note: string;
  price: string;
  kind: SkuKind;
  sparks?: number;
  buffs?: string[];
}

export const PRODUCTS: Product[] = [
  { id: 'lumen_starter', title: 'Набор новичка', note: '900 ✦ · щит ×2 · талисман ×2', price: '79 ₽', kind: 'bundle', sparks: 900, buffs: ['shield', 'shield', 'charm', 'charm'] },
  { id: 'lumen_sparks_600', title: 'Горсть искр', note: '600 ✦', price: '69 ₽', kind: 'sparks', sparks: 600 },
  { id: 'lumen_sparks_1600', title: 'Сноп искр', note: '1 600 ✦', price: '129 ₽', kind: 'sparks', sparks: 1600 },
  { id: 'lumen_sparks_4200', title: 'Купол искр', note: '4 200 ✦', price: '249 ₽', kind: 'sparks', sparks: 4200 },
  { id: 'lumen_sparks_9500', title: 'Шторм искр', note: '9 500 ✦', price: '419 ₽', kind: 'sparks', sparks: 9500 },
  { id: 'lumen_noads', title: 'Без рекламы', note: 'Никаких межстраничных, навсегда', price: '149 ₽', kind: 'noads' },
];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Бесплатные искры за рекламу. */
export const AD_SPARKS = 70;
export const AD_COOLDOWN = 180_000;
