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
    desc: 'Глубокий кобальтово-синий свод, много свободного пространства и редкие холодно-голубые световые кольца с мягкой волной импульса.',
    price: 0,
    rich: 0.45,
    sky: '#0d1933',
    fog: 0x0d1933,
    wall: { a: '#10203d', b: '#182f58', c: '#0a1326', seam: '#050b16', cool: '#5ec8ff', warm: '#b8ecff', dark: '#081122', glass: '#cceeff' },
    look: TUNNEL_LOOKS.pulse,
    ringsHue: 0.57,
    stars: 0xc4dcff,
    starBright: 0xeef6ff,
    nebula: 0x234ca8,
    beam: 0x4ca8eb,
    strut: 0x23417a,
    runway: 0x82cfff,
    rail: 0x5ec8ff,
    planets: mkPlanets([0x2b55b8, 0x0c183c], [0x4c7ce0, 0x112454], [0x1f3d8a, 0x08112b]),
    accent: '#5ec8ff',
    sonar: '#6ef7d8',
  },
  {
    id: 'copper',
    name: 'Медные кольца',
    desc: 'Матовый тёмно-бронзовый металл, аккуратные сегментированные янтарные дуги и спокойная тёплая перспектива. Препятствия — холодные.',
    price: 0,
    rich: 0.42,
    warm: true,
    sky: '#18100b',
    fog: 0x18100b,
    wall: { a: '#211610', b: '#2e1f16', c: '#120b08', seam: '#080503', cool: '#f09a36', warm: '#ffd28e', dark: '#0e0906', glass: '#ffdfa8' },
    look: TUNNEL_LOOKS.copper,
    ringsHue: 0.08,
    stars: 0xffdfb0,
    starBright: 0xfff5e4,
    nebula: 0x6b3812,
    beam: 0xc87a28,
    strut: 0x5c3718,
    runway: 0xf5b35c,
    rail: 0xe88d2a,
    planets: mkPlanets([0xd96b27, 0x521c04], [0xf2b857, 0x5e3c06], [0x9e3616, 0x2e0b03]),
    accent: '#f09a36',
    sonar: '#ffc678',
  },
  {
    id: 'polar',
    name: 'Полярная глубина',
    desc: 'Бирюзовый абиссальный свод и плавная лента сдержанных изумрудных и фиолетово-синих оттенков полярного сияния.',
    price: 0,
    rich: 0.48,
    sky: '#08212b',
    fog: 0x08212b,
    wall: { a: '#0c2c38', b: '#134050', c: '#071a22', seam: '#030e14', cool: '#4de6cf', warm: '#98ffeb', dark: '#06161d', glass: '#c8fff4' },
    look: TUNNEL_LOOKS.polar,
    ringsHue: 0.49,
    stars: 0xa8f7e8,
    starBright: 0xe6fffb,
    nebula: 0x148291,
    beam: 0x35c9b8,
    strut: 0x1a606e,
    runway: 0x6cead9,
    rail: 0x52d1e0,
    planets: mkPlanets([0x24b5a8, 0x063834], [0x5a4fcf, 0x181042], [0x1c7fa8, 0x052438]),
    accent: '#4de6cf',
    sonar: '#7ff3dc',
  },
  // ---------- Платные (5): по возрастанию цены ----------
  {
    id: 'lemon',
    name: 'Лимонный свет',
    desc: 'Благородная графитовая основа, лаконичные золотисто-лимонные световые кольца и солнечные вспышки при сборе. Препятствия — бирюзовые.',
    price: 900,
    rich: 0.55,
    warm: true,
    sky: '#141728',
    fog: 0x141728,
    wall: { a: '#191d2e', b: '#23283d', c: '#0f121e', seam: '#080910', cool: '#ffe14d', warm: '#fff5b8', dark: '#0c0e18', glass: '#fff7c8' },
    look: TUNNEL_LOOKS.lemon,
    ringsHue: 0.14,
    stars: 0xfff3b8,
    starBright: 0xffffff,
    nebula: 0x8f6c16,
    beam: 0xe6c332,
    strut: 0x69581a,
    runway: 0xffea78,
    rail: 0xf7d43b,
    planets: mkPlanets([0xe8c42a, 0x4d3c06], [0xff9e32, 0x522804], [0xfff08a, 0x4a3f0c]),
    accent: '#ffe14d',
    sonar: '#fff7a0',
  },
  {
    id: 'zero',
    name: 'Нулевая точка',
    desc: 'Строгий графитовый монолит: гладкие антрацитовые панели, тонкие серебристые кольца и гравитационные импульсы при взаимодействии.',
    price: 1400,
    rich: 0.52,
    sky: '#10141f',
    fog: 0x10141f,
    wall: { a: '#131722', b: '#1c2230', c: '#0b0e15', seam: '#05060a', cool: '#ced4e0', warm: '#f2f5fa', dark: '#080b11', glass: '#ffffff' },
    look: TUNNEL_LOOKS.zero,
    ringsHue: 0.61,
    stars: 0xb8c0ce,
    starBright: 0xf4f7fc,
    nebula: 0x262c3a,
    beam: 0x8c96a8,
    strut: 0x323846,
    runway: 0xbec6d4,
    rail: 0xdce2ed,
    planets: mkPlanets([0x222630, 0x080a0e], [0x2a2f3a, 0x0b0d12], [0x181b22, 0x050608]),
    accent: '#ced4e0',
    sonar: '#ffffff',
  },
  {
    id: 'magma',
    name: 'Жерло вулкана',
    desc: 'Базальтовый свод, редкие тлеющие пояса, термальное небо и огненные вихри при сборе светлячков. Препятствия — бирюзовые.',
    price: 1900,
    rich: 0.68,
    warm: true,
    sky: '#1f0906',
    fog: 0x1f0906,
    wall: { a: '#240c09', b: '#33110c', c: '#140604', seam: '#090202', cool: '#ff5e1f', warm: '#ffae66', dark: '#100503', glass: '#ffd2a6' },
    look: TUNNEL_LOOKS.magma,
    ringsHue: 0.04,
    stars: 0xffcfa0,
    starBright: 0xfff0de,
    nebula: 0xa8260c,
    beam: 0xd94814,
    strut: 0x6e220b,
    runway: 0xff8c4a,
    rail: 0xff5a24,
    planets: mkPlanets([0xe04016, 0x591003], [0xff9036, 0x592904], [0x9e190b, 0x2b0502]),
    accent: '#ff6426',
    sonar: '#ffae7a',
  },
  {
    id: 'crystal',
    name: 'Кристальный разлом',
    desc: 'Сапфировая основа, ледяные каустики высокого разрешения и кристаллические вспышки преломления при взаимодействии.',
    price: 2600,
    rich: 0.78,
    sky: '#0b1b38',
    fog: 0x0b1b38,
    wall: { a: '#102344', b: '#1a3868', c: '#081326', seam: '#040914', cool: '#b4e4ff', warm: '#eef9ff', dark: '#060f1e', glass: '#e6f6ff' },
    look: TUNNEL_LOOKS.crystal,
    ringsHue: 0.56,
    stars: 0xdff2ff,
    starBright: 0xffffff,
    nebula: 0x2864b2,
    beam: 0x88ccff,
    strut: 0x2d5c94,
    runway: 0xcceeff,
    rail: 0x94d4ff,
    planets: mkPlanets([0x9ed8ff, 0x14304d], [0x547ec4, 0x0c1838], [0xcceeff, 0x1b3652]),
    accent: '#b4e4ff',
    sonar: '#d4f6ff',
  },
  {
    id: 'prism',
    name: 'Призматический сон',
    desc: 'Индиго-фиолетовый свод, шелковистое спектральное небо и хроматические волны при сборе светлячков и обходе угроз.',
    price: 3400,
    rich: 0.88,
    warm: true,
    sky: '#150b2e',
    fog: 0x150b2e,
    wall: { a: '#1c103b', b: '#2b1957', c: '#0f0822', seam: '#070312', cool: '#e87aff', warm: '#9ce8ff', dark: '#0b061a', glass: '#f5d6ff' },
    look: TUNNEL_LOOKS.prism,
    ringsHue: 0.82,
    stars: 0xead8ff,
    starBright: 0xffffff,
    nebula: 0x702cc0,
    beam: 0xb86eff,
    strut: 0x562e91,
    runway: 0xe5a8ff,
    rail: 0xb88cff,
    planets: mkPlanets([0x8b5cf6, 0x260e5c], [0xe879f9, 0x4a0e3a], [0x60a5fa, 0x122652]),
    accent: '#e87aff',
    sonar: '#e9b8ff',
  },
];

/** Старые id тоннелей (до обновления линейки) → новые, по месту в линейке и цене. */
export const LEGACY_THEME_IDS: Record<string, string> = {
  void: 'pulse',
  tidal: 'copper',
  glacier: 'polar',
  reactor: 'lemon',
  current: 'lemon',
  crimson: 'prism',
  silk: 'magma',
  corona: 'magma',
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

// ---------------- Достижения (хардкорная прогрессия: долгий гринд или донат) ----------------
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  target: number;
  stat: 'runs' | 'totalOrbs' | 'totalDist' | 'totalNear' | 'bestCombo' | 'best' | 'owned' | 'themes';
  sparks: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'runs_50', name: 'Закалка пустотой', desc: 'Завершить 50 забегов в тоннеле', target: 50, stat: 'runs', sparks: 35 },
  { id: 'dist_150k', name: 'Сквозь бездну', desc: 'Пролететь 150 000 м суммарно', target: 150000, stat: 'totalDist', sparks: 60 },
  { id: 'orbs_4000', name: 'Ловец созвездий', desc: 'Собрать 4 000 светлячков суммарно', target: 4000, stat: 'totalOrbs', sparks: 70 },
  { id: 'near_1200', name: 'По лезвию бритвы', desc: 'Сделать 1 200 опасных проходов впритирку', target: 1200, stat: 'totalNear', sparks: 85 },
  { id: 'combo_55', name: 'Сверхпроводник', desc: 'Удержать непрерывное комбо ×55 за забег', target: 55, stat: 'bestCombo', sparks: 95 },
  { id: 'score_120k', name: 'Покоритель тьмы', desc: 'Набрать 120 000 очков за один забег', target: 120000, stat: 'best', sparks: 110 },
  { id: 'wardrobe_6', name: 'Коллекционер ядер', desc: 'Собрать 6 скинов искры (включая платные)', target: 6, stat: 'owned', sparks: 90 },
  { id: 'designer_6', name: 'Инженер горизонтов', desc: 'Открыть 6 архитектур тоннеля', target: 6, stat: 'themes', sparks: 110 },
  { id: 'wardrobe_all', name: 'Абсолютный спектр', desc: 'Открыть все 8 скинов искры', target: 8, stat: 'owned', sparks: 160 },
  { id: 'designer_all', name: 'Владыка измерения', desc: 'Открыть все 8 тоннелей', target: 8, stat: 'themes', sparks: 200 },
  { id: 'dist_600k', name: 'Сверхсветовой марафон', desc: 'Пролететь 600 000 м суммарно', target: 600000, stat: 'totalDist', sparks: 170 },
  { id: 'orbs_12000', name: 'Хранитель светил', desc: 'Собрать 12 000 светлячков суммарно', target: 12000, stat: 'totalOrbs', sparks: 190 },
  { id: 'combo_95', name: 'Бог потока', desc: 'Удержать непрерывное комбо ×95 за забег', target: 95, stat: 'bestCombo', sparks: 210 },
  { id: 'runs_400', name: 'Вечный странник', desc: 'Провести 400 забегов в тоннеле', target: 400, stat: 'runs', sparks: 240 },
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
  /** цена в рублях — для сортировки и расчёта выгоды */
  rub: number;
  /** выделенные выгодные предложения */
  tier?: 'starter' | 'good' | 'best';
}

export const PRODUCTS: Product[] = [
  { id: 'lumen_sparks_600', title: 'Горсть искр', note: '600 ✦', price: '69 ₽', kind: 'sparks', sparks: 600, rub: 69 },
  { id: 'lumen_starter', title: 'Набор новичка', note: '900 ✦ · щит ×2 · талисман ×2', price: '79 ₽', kind: 'bundle', sparks: 900, buffs: ['shield', 'shield', 'charm', 'charm'], rub: 79, tier: 'starter' },
  { id: 'lumen_sparks_1600', title: 'Куча искр', note: '1 600 ✦', price: '129 ₽', kind: 'sparks', sparks: 1600, rub: 129 },
  { id: 'lumen_noads', title: 'Без рекламы', note: 'Никаких межстраничных, навсегда', price: '149 ₽', kind: 'noads', rub: 149 },
  { id: 'lumen_sparks_4200', title: 'Купол искр', note: '4 200 ✦', price: '249 ₽', kind: 'sparks', sparks: 4200, rub: 249, tier: 'good' },
  { id: 'lumen_sparks_9500', title: 'Шторм искр', note: '9 500 ✦', price: '419 ₽', kind: 'sparks', sparks: 9500, rub: 419, tier: 'best' },
];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Бесплатные искры за рекламу. */
export const AD_SPARKS = 40;
export const AD_COOLDOWN = 180_000;
