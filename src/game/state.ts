// Прогрессия и сохранение LUMEN. Одна валюта (✦ искры): копишь игрой или покупаешь за рубли.

import { ACHIEVEMENTS, BUFFS, THEMES, FREE_THEME_IDS, migrateThemeId, type Product } from './economy';

export type SparkShape = 'plasma' | 'frost' | 'quartz' | 'ring' | 'flame' | 'pulsar' | 'void' | 'star';

export interface Skin {
  id: string;
  name: string;
  desc: string;
  price: number; // ✦, 0 = бесплатно
  shape: SparkShape;
  core: number;
  mid: number;
  glow: number;
  trail: number;
  light: number;
  ringShift: number;
  drainMult: number;
  magnetDur: number;
  orbLightMult: number;
  absorbOnce: boolean;
  startShield: boolean;
}

// 3 бесплатных текстурированных ядра + 5 платных авторских форм с живыми текстурами и перками.
export const SKINS: Skin[] = [
  // ---------- Бесплатные (3) ----------
  {
    id: 'spark',
    name: 'Солнечная искра',
    desc: 'Живая капля солнечной плазмы с переливающейся короной. Честный старт.',
    price: 0,
    shape: 'plasma',
    core: 0xfff8e2,
    mid: 0xffc857,
    glow: 0xffa82e,
    trail: 0xff7e24,
    light: 0xffb340,
    ringShift: 0,
    drainMult: 1,
    magnetDur: 7,
    orbLightMult: 1,
    absorbOnce: false,
    startShield: false,
  },
  {
    id: 'ice',
    name: 'Крио-ядро',
    desc: 'Морозный сапфировый кристалл с ледяными прожилками и холодным сиянием.',
    price: 0,
    shape: 'frost',
    core: 0xf2fbff,
    mid: 0x86dcff,
    glow: 0x47bfff,
    trail: 0x2b86e6,
    light: 0x7ad4ff,
    ringShift: 0.03,
    drainMult: 1,
    magnetDur: 7,
    orbLightMult: 1,
    absorbOnce: false,
    startShield: false,
  },
  {
    id: 'rose',
    name: 'Розовый кварц',
    desc: 'Перламутровая сфера с шёлковыми разводами розовой туманности внутри.',
    price: 0,
    shape: 'quartz',
    core: 0xfff0f6,
    mid: 0xff9ec7,
    glow: 0xff6b9e,
    trail: 0xe2427c,
    light: 0xff88b3,
    ringShift: 0.95,
    drainMult: 1,
    magnetDur: 7,
    orbLightMult: 1,
    absorbOnce: false,
    startShield: false,
  },
  // ---------- Платные (5) ----------
  {
    id: 'aurora',
    name: 'Аврора',
    desc: 'Бирюзовое ядро с лентами сияния, двойной орбитой и спутниками. Свет гаснет на 6% медленнее.',
    price: 320,
    shape: 'ring',
    core: 0xe6fff8,
    mid: 0x48f5cf,
    glow: 0x1ee0b5,
    trail: 0x0fb494,
    light: 0x2ee6c0,
    ringShift: 0.42,
    drainMult: 0.94,
    magnetDur: 7,
    orbLightMult: 1,
    absorbOnce: false,
    startShield: false,
  },
  {
    id: 'ember',
    name: 'Горнило',
    desc: 'Вулканическое ядро с лавовыми разломами в базальтовой корке и вихрем пламени. Магнит +3 с.',
    price: 650,
    shape: 'flame',
    core: 0xfff0d4,
    mid: 0xff7b29,
    glow: 0xff4921,
    trail: 0xff2968,
    light: 0xff6a33,
    ringShift: 0.9,
    drainMult: 1,
    magnetDur: 10,
    orbLightMult: 1,
    absorbOnce: false,
    startShield: false,
  },
  {
    id: 'pulsar',
    name: 'Пульсар',
    desc: 'Нейтронная звезда с грозовыми разрядами, спиральным диском и джетами. Светлячки дают +12% света.',
    price: 1050,
    shape: 'pulsar',
    core: 0xf0f8ff,
    mid: 0x5ce1ff,
    glow: 0x3b82ff,
    trail: 0x56ccf2,
    light: 0x6ecbff,
    ringShift: 0.52,
    drainMult: 1,
    magnetDur: 8,
    orbLightMult: 1.12,
    absorbOnce: false,
    startShield: false,
  },
  {
    id: 'umbra',
    name: 'Умбра',
    desc: 'Горизонт событий в мягком фиолетовом сиянии с гравитационным кольцом. Первый удар не сбрасывает комбо.',
    price: 1500,
    shape: 'void',
    core: 0xefe6ff,
    mid: 0xb185ff,
    glow: 0x8b5cf6,
    trail: 0x6a3cf0,
    light: 0x9b74ff,
    ringShift: 0.68,
    drainMult: 1,
    magnetDur: 7,
    orbLightMult: 1,
    absorbOnce: true,
    startShield: false,
  },
  {
    id: 'nova',
    name: 'Сверхновая',
    desc: 'Флагман: компактный огранённый кристалл-сердце с иглами света, гироскопом из трёх колец и ударными волнами взрыва. Старт со щитом и −4% убыли света.',
    price: 2200,
    shape: 'star',
    core: 0xffffff,
    mid: 0xffe8a3,
    glow: 0xffd166,
    trail: 0x6ef7d8,
    light: 0xfff0c4,
    ringShift: 0.16,
    drainMult: 0.96,
    magnetDur: 9,
    orbLightMult: 1.05,
    absorbOnce: false,
    startShield: true,
  },
];

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export interface MissionDef {
  id: string;
  label: string;
  target: number;
  reward: number;
  icon: 'orb' | 'distance' | 'power' | 'near' | 'combo';
}

const MISSION_POOL: MissionDef[] = [
  { id: 'orbs450', label: 'Собрать 450 светлячков', target: 450, reward: 40, icon: 'orb' },
  { id: 'orbs950', label: 'Собрать 950 светлячков', target: 950, reward: 75, icon: 'orb' },
  { id: 'dist28000', label: 'Пролететь 28 000 м', target: 28000, reward: 45, icon: 'distance' },
  { id: 'dist65000', label: 'Пролететь 65 000 м', target: 65000, reward: 85, icon: 'distance' },
  { id: 'power35', label: 'Взять 35 бонусов', target: 35, reward: 50, icon: 'power' },
  { id: 'near140', label: '140 проходов впритирку', target: 140, reward: 65, icon: 'near' },
  { id: 'combo40', label: 'Удержать комбо ×40', target: 40, reward: 60, icon: 'combo' },
  { id: 'combo65', label: 'Удержать комбо ×65', target: 65, reward: 90, icon: 'combo' },
];

export interface MissionState {
  p: number;
  done: boolean;
}

export interface SaveData {
  v: number;
  sparks: number;
  owned: string[];
  skin: string;
  themes: string[];
  theme: string;
  buffs: Record<string, number>;
  loadout: string[];
  best: number;
  runs: number;
  totalOrbs: number;
  totalDist: number;
  totalNear: number;
  bestCombo: number;
  day: string;
  missions: MissionDef[];
  progress: Record<string, MissionState>;
  history: { score: number; when: number }[];
  achDone: string[];
  entitlements: string[];
  freeAdAt: number;
}

const KEY = 'lumen.save.v3';

function seeded(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function rollMissions(day: string): MissionDef[] {
  const rnd = seeded(day);
  const pool = [...MISSION_POOL];
  const out: MissionDef[] = [];
  while (out.length < 3 && pool.length) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function defaultSave(): SaveData {
  const day = today();
  return {
    v: 3,
    sparks: 0,
    owned: ['spark', 'ice', 'rose'],
    skin: 'spark',
    themes: [...FREE_THEME_IDS],
    theme: 'pulse',
    buffs: {},
    loadout: [],
    best: 0,
    runs: 0,
    totalOrbs: 0,
    totalDist: 0,
    totalNear: 0,
    bestCombo: 0,
    day,
    missions: rollMissions(day),
    progress: {},
    history: [],
    achDone: [],
    entitlements: [],
    freeAdAt: 0,
  };
}

function withDefaults(parsed: Partial<SaveData>): SaveData {
  const base = defaultSave();
  const d: SaveData = { ...base, ...parsed } as SaveData;
  d.owned = Array.from(new Set(['spark', 'ice', 'rose', ...(d.owned ?? [])]));
  d.themes = Array.from(new Set([...FREE_THEME_IDS, ...(d.themes ?? []).map(migrateThemeId)]));
  d.theme = migrateThemeId(d.theme ?? 'pulse');
  if (!d.themes.includes(d.theme)) d.theme = 'pulse';
  d.buffs = d.buffs ?? {};
  d.loadout = (d.loadout ?? []).filter((id) => BUFFS.some((b) => b.id === id && (d.buffs[id] ?? 0) > 0)).slice(0, 2);
  d.progress = d.progress ?? {};
  d.history = d.history ?? [];
  d.achDone = d.achDone ?? [];
  d.entitlements = d.entitlements ?? [];
  const validMissions = d.missions?.length === 3 && d.missions.every((m) => MISSION_POOL.some((p) => p.id === m.id));
  if (!validMissions) {
    d.missions = rollMissions(d.day);
    d.progress = {};
  }
  return d;
}

export function loadSave(): SaveData {
  const day = today();
  let d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('lumen.save.v2') ?? localStorage.getItem('lumen.save.v1');
    if (raw) d = withDefaults(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    /* ignore */
  }
  if (d.day !== day) {
    d.day = day;
    d.missions = rollMissions(day);
    d.progress = {};
  }
  return d;
}

export function persist(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

// ---------------- Забег ----------------
export interface RunSummary {
  score: number;
  orbs: number;
  distance: number;
  powerups: number;
  nearMiss: number;
  comboMax: number;
  flowMax: number;
}

export interface RunOutcome {
  save: SaveData;
  sparksEarned: number;
  missionsDone: MissionDef[];
  achievements: { name: string; sparks: number }[];
}

function statValueOf(d: SaveData, stat: (typeof ACHIEVEMENTS)[number]['stat']): number {
  switch (stat) {
    case 'owned':
      return d.owned.length;
    case 'themes':
      return d.themes.length;
    case 'runs':
      return d.runs;
    case 'totalOrbs':
      return d.totalOrbs;
    case 'totalDist':
      return d.totalDist;
    case 'totalNear':
      return d.totalNear;
    case 'best':
      return d.best;
    case 'bestCombo':
    default:
      return d.bestCombo;
  }
}

function awardUnlockedAchievements(next: SaveData): RunOutcome['achievements'] {
  const unlocked: RunOutcome['achievements'] = [];
  for (const a of ACHIEVEMENTS) {
    if (next.achDone.includes(a.id)) continue;
    if (statValueOf(next, a.stat) >= a.target) {
      next.achDone.push(a.id);
      next.sparks += a.sparks;
      unlocked.push({ name: a.name, sparks: a.sparks });
    }
  }
  return unlocked;
}

export function applyRun(d: SaveData, r: RunSummary, x2: boolean): RunOutcome {
  const next = clone(d);
  const mult = x2 ? 2 : 1;

  // Награда за забег: ровно 1 искра за каждую полную тысячу набранных очков (12 480 очков → 12 искр)
  const base = Math.floor(Math.max(0, r.score) / 1000);
  const earned = base * mult;
  next.sparks += earned;
  next.runs += 1;
  next.totalOrbs += r.orbs;
  next.totalDist += r.distance;
  next.totalNear += r.nearMiss;
  next.bestCombo = Math.max(next.bestCombo, r.comboMax);
  next.best = Math.max(next.best, r.score);
  next.history = [{ score: r.score, when: Date.now() }, ...d.history].slice(0, 10);

  const value: Record<string, number> = {
    orb: r.orbs,
    distance: r.distance,
    power: r.powerups,
    near: r.nearMiss,
    combo: r.comboMax,
    runs: 1,
  };

  const missionsDone: MissionDef[] = [];
  for (const m of next.missions) {
    const cur = next.progress[m.id] ?? { p: 0, done: false };
    if (cur.done) continue;
    const add = m.icon === 'combo' ? Math.max(cur.p, value[m.icon] ?? 0) : cur.p + (value[m.icon] ?? 0);
    const p = Math.min(m.target, add);
    const done = p >= m.target;
    next.progress[m.id] = { p, done };
    if (done) {
      next.sparks += m.reward * mult;
      missionsDone.push(m);
    }
  }

  const achievements = awardUnlockedAchievements(next);

  return { save: next, sparksEarned: earned, missionsDone, achievements };
}

export function consumeLoadout(d: SaveData): SaveData {
  const next = clone(d);
  for (const id of next.loadout) {
    const have = next.buffs[id] ?? 0;
    if (have > 0) next.buffs[id] = have - 1;
  }
  next.loadout = next.loadout.filter((id) => (next.buffs[id] ?? 0) > 0);
  return next;
}

// ---------------- Магазин ----------------
export function buySkin(d: SaveData, price: number, id: string): SaveData {
  if (d.owned.includes(id) || d.sparks < price) return d;
  const next = clone(d);
  next.sparks -= price;
  next.owned.push(id);
  next.skin = id;
  awardUnlockedAchievements(next);
  return next;
}

export function buyTheme(d: SaveData, themeId: string, price: number): SaveData {
  if (d.themes.includes(themeId)) return { ...d, theme: themeId };
  if (d.sparks < price) return d;
  const next = clone(d);
  next.sparks -= price;
  next.themes.push(themeId);
  next.theme = themeId;
  awardUnlockedAchievements(next);
  return next;
}

export function selectTheme(d: SaveData, id: string): SaveData {
  const t = THEMES.find((x) => x.id === id);
  const isFree = t?.price === 0;
  if (!d.themes.includes(id) && !isFree) return d;
  const themes = d.themes.includes(id) ? d.themes : [...d.themes, id];
  return { ...d, themes, theme: id };
}

export function buyBuff(d: SaveData, buffId: string, qty = 1): SaveData {
  const def = BUFFS.find((b) => b.id === buffId);
  if (!def || d.sparks < def.price * qty) return d;
  const next = clone(d);
  next.sparks -= def.price * qty;
  next.buffs[buffId] = (next.buffs[buffId] ?? 0) + qty;
  return next;
}

export function toggleLoadout(d: SaveData, buffId: string): SaveData {
  const next = clone(d);
  if (next.loadout.includes(buffId)) next.loadout = next.loadout.filter((x) => x !== buffId);
  else if ((next.buffs[buffId] ?? 0) > 0) next.loadout = [...next.loadout, buffId].slice(-2);
  return next;
}

// ---------------- Облако ----------------
function clone(d: SaveData): SaveData {
  return {
    ...d,
    owned: [...d.owned],
    themes: [...d.themes],
    loadout: [...d.loadout],
    buffs: { ...d.buffs },
    missions: [...d.missions],
    progress: { ...d.progress },
    history: [...d.history],
    achDone: [...d.achDone],
    entitlements: [...d.entitlements],
  };
}

export function toCloud(d: SaveData) {
  return {
    sparks: d.sparks,
    owned: d.owned,
    skin: d.skin,
    themes: d.themes,
    theme: d.theme,
    best: d.best,
    runs: d.runs,
    totalOrbs: d.totalOrbs,
    totalDist: d.totalDist,
    totalNear: d.totalNear,
    bestCombo: d.bestCombo,
    achDone: d.achDone,
    entitlements: d.entitlements,
    buffs: d.buffs,
    v: d.v,
  };
}

export function mergeCloud(local: SaveData, cloud: Record<string, unknown> | null): SaveData {
  if (!cloud) return local;
  const next = clone(local);
  const n = (k: string) => Number(cloud[k]) || 0;
  const arr = (k: string) => (Array.isArray(cloud[k]) ? (cloud[k] as string[]) : []);
  next.sparks = Math.max(next.sparks, n('sparks'));
  next.best = Math.max(next.best, n('best'));
  next.runs = Math.max(next.runs, n('runs'));
  next.totalOrbs = Math.max(next.totalOrbs, n('totalOrbs'));
  next.totalDist = Math.max(next.totalDist, n('totalDist'));
  next.totalNear = Math.max(next.totalNear, n('totalNear'));
  next.bestCombo = Math.max(next.bestCombo, n('bestCombo'));
  next.owned = Array.from(new Set(['spark', 'ice', 'rose', ...next.owned, ...arr('owned')]));
  next.themes = Array.from(new Set([...FREE_THEME_IDS, ...next.themes, ...arr('themes').map(migrateThemeId)]));
  next.entitlements = Array.from(new Set([...next.entitlements, ...arr('entitlements')]));
  next.achDone = Array.from(new Set([...next.achDone, ...arr('achDone')]));
  const cBuffs = cloud.buffs as Record<string, number> | undefined;
  if (cBuffs) for (const k of Object.keys(cBuffs)) next.buffs[k] = Math.max(next.buffs[k] ?? 0, Number(cBuffs[k]) || 0);
  const skin = cloud.skin as string | undefined;
  if (skin && next.owned.includes(skin)) next.skin = skin;
  const theme = cloud.theme ? migrateThemeId(String(cloud.theme)) : undefined;
  if (theme && next.themes.includes(theme)) next.theme = theme;
  return next;
}

export { THEMES };

export function achievementProgress(d: SaveData): { name: string; desc: string; p: number; target: number; done: boolean; sparks: number }[] {
  return ACHIEVEMENTS.map((a) => {
    const v = statValueOf(d, a.stat);
    return { name: a.name, desc: a.desc, p: Math.min(a.target, v), target: a.target, done: d.achDone.includes(a.id), sparks: a.sparks };
  });
}

export function hasEntitlement(d: SaveData, id: string): boolean {
  return d.entitlements.includes(id);
}

export function grantProduct(d: SaveData, p: Product): SaveData {
  const next = clone(d);
  if (p.sparks) next.sparks += p.sparks;
  for (const b of p.buffs ?? []) next.buffs[b] = (next.buffs[b] ?? 0) + 1;
  if (p.kind === 'noads' && !next.entitlements.includes('noads')) next.entitlements.push('noads');
  return next;
}
