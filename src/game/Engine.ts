import * as THREE from 'three';
import { Sound } from './Sound';
import { createTunnelFx, type TunnelFx } from './tunnelFx';
import { STAR_PERIOD, buildSparkRig, type SparkRig } from './sparkSkins';
import { skinById, type Skin } from './state';
import { themeById, type Theme, type LoadoutFx, emptyFx } from './economy';
import {
  WALL_TILE,
  buildRibGeos,
  createRibMats,
  createSkyDome,
  disposeRibGeos,
  makeRaysTexture,
  makeThinRingTexture,
  mergeSimpleGeometries,
  paintWallTexture,
  renderThemePreview,
  ribPieces,
  beamAngle,
  type RibGeos,
  type RibMats,
  type SkyDome,
} from './tunnels';

export interface RadarDot {
  x: number; // 0..1 по горизонтали (0.5 = дуга игрока)
  y: number; // 0..1 по глубине: 0 — рядом с нами, 1 — на краю дальности
  k: 0 | 1 | 2 | 3 | 4; // 0 — мина, 1 — светлячок, 2 — бафф, 3 — стенка (отрезок), 4 — охотник
  w?: number; // для стенки: половина её ширины в долях x
  e?: boolean; // угроза за краем обзора сонара
  ang?: number; // точный относительный угол в тоннеле (-PI..PI, 0 = курс игрока внизу)
  dist?: number; // линейная дистанция 0..1 вдоль тоннеля
  arc?: number; // для стенки: полуширина дуги в радианах
}

export interface SonarFrame {
  dots: RadarDot[];
  scrollZ: number;
  playerAngle: number;
  speed: number;
  danger: number;
}

// Глобальное живое состояние сонара (обновляется каждый кадр 60/120 FPS синхронно с рендером игры)
export const liveSonarFrame: SonarFrame = {
  dots: [],
  scrollZ: 0,
  playerAngle: -Math.PI / 2,
  speed: 27,
  danger: 0,
};

export interface HudState {
  score: number;
  light: number; // 0..100
  speed: number;
  combo: number;
  comboT: number; // 0..1 — остаток времени комбо
  orbs: number;
  distance: number;
  magnet: number;
  overcharge: number; // секунд осталось
  shield: boolean;
  shieldLeft: number; // секунд до конца щита-подбираемого (0 — щит без таймера или его нет)
  warden: boolean; // «Пепельный оберег» ещё не потрачен
  danger: number; // 0..1
  flow: number; // 0..1 — «Поток»
  powerups: number;
  nearMiss: number;
  radar: RadarDot[];
}

export interface GameResult {
  score: number;
  orbs: number;
  distance: number;
  powerups: number;
  nearMiss: number;
  comboMax: number;
  flowMax: number;
}

type Kind = 'orb' | 'shard' | 'flash' | 'magnet' | 'overcharge' | 'shield' | 'wall' | 'hunter';

interface Entity {
  mesh: THREE.Object3D;
  kind: Kind;
  angle: number;
  z: number;
  alive: boolean;
  spin: number;
  radius: number;
  missed: boolean;
  dir: number;
  spinner?: THREE.Object3D; // вращающаяся часть (подложка-тень остаётся неподвижной)
  shadow?: THREE.Object3D; // мягкая тень препятствия на обшивке тоннеля (держится на угле объекта)
  glints?: THREE.Sprite[]; // небольшие стильные рассеивающиеся блики препятствий
}

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SharedEntityAssets {
  orbCoreGeo: THREE.SphereGeometry;
  orbCoreMat: THREE.MeshBasicMaterial;
  orbGlowMat: THREE.SpriteMaterial;

  shardGeo: THREE.OctahedronGeometry;
  shardMat: THREE.MeshPhongMaterial;
  shardOutlineGeo: THREE.BufferGeometry; // тёмный контур: отделяет осколок от любого фона
  shardOutlineMat: THREE.MeshBasicMaterial;
  shardEdgesGeo: THREE.BufferGeometry; // тонкая кромка: трубки по рёбрам
  shardEdgeMat: THREE.MeshBasicMaterial;
  shardRimGeo: THREE.BufferGeometry; // мягкое свечение кромки
  shardRimMat: THREE.MeshBasicMaterial;
  shardGlowMat: THREE.SpriteMaterial;

  // Вспышка — молния
  boltGeo: THREE.BufferGeometry;
  boltMat: THREE.MeshBasicMaterial;
  boltEdgesGeo: THREE.BufferGeometry;
  boltEdgeMat: THREE.LineBasicMaterial;
  flashRingGeo: THREE.TorusGeometry;
  flashRingMat: THREE.MeshBasicMaterial;
  flashGlowMat: THREE.SpriteMaterial;

  magnetUGeo: THREE.TorusGeometry;
  magnetUMat: THREE.MeshLambertMaterial;
  magnetTipGeo: THREE.CylinderGeometry;
  magnetTipMat: THREE.MeshLambertMaterial;
  magnetGlowMat: THREE.SpriteMaterial;

  // Осколок и мина-охотник в едином стиле со стенками: ядро, шипы, рельефные пояса и неоновое кольцо
  hunterCoreGeo: THREE.IcosahedronGeometry;
  hunterCoreMat: THREE.MeshPhongMaterial;
  hunterOutlineGeo: THREE.BufferGeometry;
  hunterSpikeGeo: THREE.BufferGeometry;
  hunterSpikeMat: THREE.MeshPhongMaterial;
  hunterRingGeo: THREE.TorusGeometry;
  hunterRingSoftGeo: THREE.TorusGeometry;
  hunterRingMat: THREE.MeshBasicMaterial;
  hunterGlowMat: THREE.SpriteMaterial;
  hunterRimGeo: THREE.IcosahedronGeometry; // световая кромка (френель) вокруг ядра
  hunterBeltGeo: THREE.BufferGeometry; // экваториальный пояс и манжеты у основания шипов (в стиле рёбер стенки)
  hunterBeltMat: THREE.MeshPhongMaterial;
  hunterTipGeo: THREE.BufferGeometry; // светящиеся «огни» на концах шипов
  hunterTipSoftGeo: THREE.BufferGeometry; // мягкий ореол на концах шипов
  hunterTipMat: THREE.MeshBasicMaterial;
  rimMat: THREE.ShaderMaterial; // общий френель-материал мягкого свечения препятствий

  // Перезарядка — батарея с зарядом
  battBodyGeo: THREE.BoxGeometry;
  battBodyMat: THREE.MeshLambertMaterial;
  battTipGeo: THREE.BoxGeometry;
  battTipMat: THREE.MeshBasicMaterial;
  battBarGeo: THREE.BoxGeometry;
  battBarMat: THREE.MeshBasicMaterial;
  battEdgesGeo: THREE.EdgesGeometry;
  battEdgeMat: THREE.LineBasicMaterial;
  overGlowMat: THREE.SpriteMaterial;

  // Щит — геральдический щит с эмблемой-звездой
  shieldBodyGeo: THREE.BufferGeometry;
  shieldBodyMat: THREE.MeshPhongMaterial;
  shieldPlateGeo: THREE.BufferGeometry;
  shieldPlateMat: THREE.MeshBasicMaterial;
  shieldEmblemGeo: THREE.BufferGeometry;
  shieldEmblemMat: THREE.MeshBasicMaterial;
  shieldEdgesGeo: THREE.EdgesGeometry;
  shieldEdgeMat: THREE.LineBasicMaterial;
  shieldRingGeo: THREE.TorusGeometry;
  shieldRingMat: THREE.MeshBasicMaterial;
  shieldGlowMat: THREE.SpriteMaterial;

  wallArcGeo: THREE.TorusGeometry;
  wallArcMat: THREE.ShaderMaterial;
  wallRimGeo: THREE.TorusGeometry;
  wallRimMergedGeo: THREE.BufferGeometry;
  wallRimMat: THREE.MeshBasicMaterial;
  wallRimSoftMat: THREE.MeshBasicMaterial;
  wallGlowMat: THREE.SpriteMaterial;
  wallCrestGeo: THREE.TorusGeometry;
  wallEndGeo: THREE.TorusGeometry;
  wallOutlineGeo: THREE.TorusGeometry;
  wallOutlineMat: THREE.MeshBasicMaterial;
  wallShellGeo: THREE.TorusGeometry; // лёгкое свечение вокруг тела стенки
  wallBandGeo: THREE.TorusGeometry; // поперечные рёбра жёсткости
  wallBandsMergedGeo: THREE.BufferGeometry;
  wallBandMat: THREE.MeshPhongMaterial;
  glintMat: THREE.SpriteMaterial; // небольшие стильные рассеивающиеся блики вместо градиента
  haloMat: THREE.SpriteMaterial;
  haloSoftMat: THREE.SpriteMaterial;
  shadowGeo: THREE.PlaneGeometry; // тень на стене тоннеля под препятствием
  shadowMat: THREE.MeshBasicMaterial;
}

type BurstKind = 'orb' | 'obstacle' | 'buff';

interface ThemeBurst {
  group: THREE.Group;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  ringC: THREE.Mesh;
  matA: THREE.MeshBasicMaterial;
  matB: THREE.MeshBasicMaterial;
  matC: THREE.MeshBasicMaterial;
  colA: number;
  colB: number;
  colC: number;
  t: number;
  dur: number;
  style: string;
  kind: BurstKind;
}

const TUNNEL_R = 5;
const PLAYER_R = 4.0;
const STAR_DUST = [0xffd166, 0x6ef7d8, 0xd4b8ff, 0xffffff];
const PLAYER_SCALE = 0.85; // искра и все её модельки на 15% меньше
const RING_COUNT = 32; // 4 тайла стены по 8 колец: ритм рёбер и текстура всегда совпадают
const RING_GAP = 8;
const WALL_LEN = 448; // 7 тайлов по 64 м: z от -384 до +64
const WALL_Z = -160; // центр стены: z=0 приходится на границу тайла
const SPAWN_Z = -175;
const DESPAWN_Z = 10;
const MAX_LIGHT = 100;
const COMBO_HOLD = 2.4;
const RADAR_RANGE = 115;
const RADAR_WIN = 1.4; // полуширина обзора сонара в радианах (≈ ±80° от дуги игрока)
const FLOW_TIME = 6;
const FLOW_STACK = 4;
const OBST_SCALE = 0.85; // все препятствия на 15% меньше
const BUFF_SCALE = 1.22; // все баффы на 22% больше
const WALL_ARC = 3.7 * OBST_SCALE * 0.9; // стена на 10% уже (~162°), остальное — зев
const WALL_SPIN = 0.48; // рад/с вращения стены на единицу спина (+20% динамики)
const TRAIL_N = 14;
const TAIL_N = 18; // звенья «метеорного» хвоста под искрой
const SPEED_START = 25.74 * 1.05; // начальная скорость +5% (≈ 27.03 м/с)
const SPEED_END = 62.415 * 1.03; // конечная скорость +3% (≈ 64.29 м/с)
const DRAIN_BASE = 3.5 * 1.03 * 1.05; // базовая скорость затемнения тоннеля +5% быстрее прежней
const DARK_INTERVAL = 15000; // каждые 15 000 очков (15к, 30к, 45к, 60к, 75к…) свет гаснет на 3% быстрее
const DARK_STEP = 0.03;
const SHIELD_DUR = 15; // секунд действия щита-баффа
const FOG_K = 0.68; // туман мягче — в конце тоннеля при 100% света видно заметно лучше
const AMB_K = 1.38; // фоновое освещение светлее и чище
const MAX_DT = 1 / 30; // шаг симуляции не больше 33 мс — преграды не «перепрыгивают» героя

export function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.68)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Тёмная подложка под объектами: отделяет их от любой обшивки (в т.ч. красной). */
function makeDarkHaloTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(2,3,10,0.95)');
  g.addColorStop(0.55, 'rgba(2,3,10,0.7)');
  g.addColorStop(0.8, 'rgba(2,3,10,0.28)');
  g.addColorStop(1, 'rgba(2,3,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Цвета опасных объектов: ВСЕ препятствия (мины, охотники, стенки) — одного цвета.
 * Обычные тоннели → тёмно-бордовый, красные/розовые (warm) тоннели → тёмно-лазурный.
 */
function mkHazard(body: number, em: number, edge: number, glow: number) {
  return {
    shardBody: body, shardEm: em, shardEdge: edge, shardGlow: glow,
    wallBody: body, wallEm: em, wallRim: edge, wallGlow: glow,
    huntBody: body, huntEm: em, huntLeg: edge, huntGlow: glow,
  };
}
const HAZARD_NORMAL = mkHazard(0x3a0612, 0x5e0e24, 0x9c2542, 0x7a1630); // тёмно-бордовый
const HAZARD_COLD = mkHazard(0x04304f, 0x0a5590, 0x2b9edc, 0x1470b4); // тёмно-лазурный

/** Единый шейдерный материал тела опасных преград (стенок, осколков и мин-охотников) с мягким внутренним переливом. */
function makeWallArcMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBodyColor: { value: new THREE.Color(HAZARD_NORMAL.wallBody) },
      uEmissiveColor: { value: new THREE.Color(HAZARD_NORMAL.wallEm) },
      uShimmerColor: { value: new THREE.Color(0xffa8cc) },
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0d1933) },
      uFogDensity: { value: 0.005 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      varying float vHoriz;
      varying float vDepth;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float localSpan = length(position.xy);
        float localPhase = localSpan < 1.2 ? (position.x * 3.4 + position.y * 2.3 + position.z * 1.8) : 0.0;
        vHoriz = mv.x + localPhase;
        vDepth = -mv.z;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uBodyColor;
      uniform vec3 uEmissiveColor;
      uniform vec3 uShimmerColor;
      uniform float uTime;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      varying float vHoriz;
      varying float vDepth;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float facing = abs(dot(N, V));
        vec3 base = uBodyColor * (0.55 + 0.55 * facing) + uEmissiveColor * 0.72;
        float innerMask = smoothstep(0.16, 0.86, facing);
        float wave1 = 0.5 + 0.5 * sin(vHoriz * 1.25 + vUv.x * 6.28318 - uTime * 2.1);
        float wave2 = 0.5 + 0.5 * cos(vHoriz * 0.85 - vUv.x * 3.14159 + uTime * 1.45);
        float shimmer = pow(wave1 * 0.65 + wave2 * 0.35, 1.45) * innerMask;
        vec3 col = mix(base, uShimmerColor, shimmer * 0.44) + uShimmerColor * (shimmer * 0.16);
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Мягкое свечение по кромке объёма (френель): центр прозрачен, край светится — «аура» без грубых спрайтов. */
function makeRimMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPulse: { value: 1 }, uPower: { value: 2.4 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPulse;
      uniform float uPower;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(uColor * f * 0.9 * uPulse, f * 0.55 * uPulse);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/** Тонкие трубки по рёбрам (EdgesGeometry): настоящая светящаяся кромка, видимая на любой дистанции. */
function tubesFromEdges(edges: THREE.BufferGeometry, radius: number): THREE.BufferGeometry {
  const pos = edges.getAttribute('position');
  const list: THREE.BufferGeometry[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i + 1 < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    dir.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) continue;
    dir.normalize();
    const g = new THREE.CylinderGeometry(radius, radius, len, 5, 1, true);
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, dir), one));
    list.push(g);
  }
  return mergeSimpleGeometries(list);
}

/** Молния для баффа «Вспышка»: узнаваемый зигзаг, выдавленный в объём. */
function makeBoltGeometry(): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  const pts: [number, number][] = [
    [0.04, 0.62],
    [0.34, 0.62],
    [0.13, 0.12],
    [0.34, 0.12],
    [-0.16, -0.66],
    [-0.04, -0.06],
    [-0.3, -0.06],
  ];
  pts.forEach(([x, y], i) => (i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -0.08);
  return g;
}

/** Щит для баффа: геральдический силуэт, выдавленный в объём. inset — на сколько уменьшить контур. */
function makeShieldGeometry(inset = 0, depth = 0.16): THREE.BufferGeometry {
  const k = 1 - inset;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.7 * k + 0.02);
  sh.bezierCurveTo(0.14 * k, 0.6 * k, 0.34 * k, 0.56 * k, 0.56 * k, 0.56 * k);
  sh.lineTo(0.56 * k, 0.02 * k);
  sh.bezierCurveTo(0.56 * k, -0.34 * k, 0.28 * k, -0.58 * k, 0, -0.78 * k);
  sh.bezierCurveTo(-0.28 * k, -0.58 * k, -0.56 * k, -0.34 * k, -0.56 * k, 0.02 * k);
  sh.lineTo(-0.56 * k, 0.56 * k);
  sh.bezierCurveTo(-0.34 * k, 0.56 * k, -0.14 * k, 0.6 * k, 0, 0.7 * k + 0.02);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth,
    bevelEnabled: depth > 0.1,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Четырёхлучевая звезда-эмблема в центре щита. */
function makeShieldEmblemGeometry(): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  const R = 0.34;
  const r = 0.095;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const rad = i % 2 === 0 ? (i % 4 === 0 ? R : R * 0.78) : r;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad - 0.04;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
}

/** Превью тоннеля для карточек Магазина — рисуется по тем же данным, что и 3D-сцена. */
export function getThemePreviewUrl(themeId: string): string {
  return renderThemePreview(themeById(themeId));
}

/** Линия «пола» тоннеля: мягкая световая полоса с тонкой осью. */
export function makeRunwayTexture(): THREE.Texture {
  const W = 256;
  const H = 64;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const c = cvs.getContext('2d')!;
  c.clearRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fillRect(W * 0.46, 0, W * 0.08, H);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(0, H * 0.5 - 1, W, 2);
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function makeStarTexture(): THREE.Texture {
  const S = 256;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(240,248,255,0.85)');
  g.addColorStop(0.45, 'rgba(205,228,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** Текстура небольшого стильного рассеивающегося блика для препятствий (без грубого градиентного пятна). */
export function makeDispersingGlintTexture(): THREE.Texture {
  const S = 256;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  const cx = S / 2;
  const cy = S / 2;

  // Тонкие заострённые лучи блика + пара мелких рассеянных искр-спутников
  const drawSpark = (x: number, y: number, rx: number, ry: number, rot: number, alpha: number) => {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = alpha;
    for (const [w, h] of [
      [rx, ry * 0.14],
      [ry * 0.14, rx * 0.78],
    ]) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h));
      g.addColorStop(0, 'rgba(255,255,255,0.98)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.52)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };

  drawSpark(cx, cy, S * 0.38, S * 0.38, Math.PI / 8, 0.92);
  drawSpark(cx + S * 0.19, cy - S * 0.16, S * 0.14, S * 0.14, -Math.PI / 6, 0.65);
  drawSpark(cx - S * 0.18, cy + S * 0.17, S * 0.11, S * 0.11, Math.PI / 5, 0.55);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: THREE.Group;
  private skyDome!: SkyDome;
  private rings: THREE.Group[] = [];
  private ribGeos: RibGeos | null = null;
  private ribMats: RibMats = createRibMats();
  private beamMeshes: THREE.Mesh[] = [];
  // Немногочисленные «важные» лучи: линия под игроком и линии к двум ближайшим угрозам
  private guideGeo!: THREE.BufferGeometry;
  private guidePlayerMat!: THREE.MeshBasicMaterial;
  private guideThreatMat!: THREE.MeshBasicMaterial;
  private guidePlayer!: THREE.Mesh;
  private guideThreats: THREE.Mesh[] = [];
  private coreGlow!: THREE.Sprite;
  private coreRays!: THREE.Sprite;
  private coreRing!: THREE.Sprite;
  private raysTex!: THREE.Texture;
  private ringTex!: THREE.Texture;
  private fogBase = 0.0074 * FOG_K;
  private ambK = 1;
  private lightK = 1;
  private tmpC = new THREE.Color();
  private tmpC2 = new THREE.Color();
  private wall: THREE.Mesh;
  private tunnelFx: TunnelFx;
  private wallMat: THREE.MeshBasicMaterial;
  private beamMat: THREE.MeshBasicMaterial;
  private strutMat: THREE.MeshBasicMaterial;
  private runway: THREE.Mesh;
  private runwayMat: THREE.MeshBasicMaterial;
  private railMat: THREE.MeshBasicMaterial;
  private space: THREE.Group;
  private strutOuter: THREE.MeshBasicMaterial;
  private streaks: THREE.Points;
  private streakMat: THREE.PointsMaterial;
  private entities: Entity[] = [];
  private entityPool = new Map<Kind, Entity[]>();
  private assets: SharedEntityAssets;
  private particles: Particle[] = [];
  private glowTex: THREE.Texture;
  private glintTex: THREE.Texture;
  private darkTex: THREE.Texture;
  private fog: THREE.FogExp2;

  private player: THREE.Group;
  private sparkRig: SparkRig;
  private playerGlow: THREE.Sprite;
  private playerLight: THREE.PointLight;
  private shieldGroup: THREE.Group;
  private shieldMats: { mat: THREE.Material; base: number }[] = [];
  private shieldBreakT = 0;
  private magnetGroup: THREE.Group;
  private magnetArcs: THREE.Mesh[] = [];
  private magnetPop = 0;
  private magnetSpawnT = 0;
  private emberT = 0;
  private novaPhase = -1;
  // Анимации взаимодействия со светлячками и препятствиями для премиальных тоннелей
  private zeroWaves: THREE.Mesh[] = [];
  private zeroRipples: { mesh: THREE.Mesh; t: number }[] = [];
  private themeBursts: ThemeBurst[] = [];
  private auraMesh: THREE.Mesh;
  private trail: THREE.Sprite[] = [];
  private trailAng: number[] = []; // «мировой» угол каждого звена шлейфа
  private trailVis = 0;
  // «Метеорный» хвост под искрой во время забега
  private tail: THREE.Sprite[] = [];
  private tailLen = 0;
  // «Пепельный оберег»: строгое тонкое кольцо, пока заряд не потрачен
  private wardenGroup!: THREE.Group;
  private wardenTicks!: THREE.Mesh;
  private wardenMats: { mat: THREE.MeshBasicMaterial; base: number }[] = [];
  private wardenBreakT = 0;
  private wardenSpin = 0;

  private ambient: THREE.AmbientLight;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private camTarget = new THREE.Vector3(0, -0.9, -20);

  private playerAngle = -Math.PI / 2;
  private targetAngle = -Math.PI / 2;
  private keyDir = 0;
  private touchDir = 0;
  private steerVel = 0;
  private leftHeld = false;
  private rightHeld = false;
  private dragging = false;
  private pointerId = -1;
  private lastPointerX = 0;
  private baseCamZ = 7.0;
  private baseCamY = 0.8;
  private baseFov = 75;

  private speed = 26;
  private light = MAX_LIGHT;
  private score = 0;
  private combo = 0;
  private comboMax = 0;
  private comboT = 0;
  private orbs = 0;
  private powerups = 0;
  private nearMiss = 0;
  private distance = 0;
  private magnetT = 0;
  private overchargeT = 0;
  private magnetDur = 7;
  private shield = false;
  private shieldT = Infinity; // сколько секунд ещё держится щит (Infinity — до первого удара)
  private absorb = false;
  private wardenCharges = 0;
  private spawnT = 0.5;
  private patternMinZ = SPAWN_Z; // самая дальняя точка последней волны (для расчёта просвета)
  private firstSpawn = true;
  private lastPattern = -1;
  private roundSeedOffset = 0;
  private time = 0;
  private scrollZ = 0;
  private bestTarget = 0;
  private shake = 0;
  private flashFx = 0;
  private skin: Skin = skinById('spark');
  private theme: Theme = themeById('pulse');
  private themeRich = 0.5;
  private wallCache = new Map<string, THREE.Texture>();
  private starPoints: THREE.Points[] = [];
  private starMatA: THREE.PointsMaterial | null = null;
  private starMatB: THREE.PointsMaterial | null = null;
  private flowT = 0;
  private flowStack = 0;
  private flowStackT = 0;
  private flowMax = 0;
  private fx: LoadoutFx = emptyFx();
  private dust: THREE.Points;
  private beatBest = false;

  // Авто-адаптация разрешения при просадках FPS и сглаживание времени кадра
  private curDpr = 1;
  private maxDpr = 2;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private smoothDt = 1 / 60;
  private overlayOpen = false;
  private needsStaticRender = true;

  // Пул точек сонара без аллокаций на каждый кадр
  private radarPool: RadarDot[] = Array.from({ length: 56 }, () => ({
    x: 0.5,
    y: 0,
    k: 0,
    w: 0,
    e: false,
    ang: 0,
    dist: 0,
    arc: 0,
  }));
  private radarOut: RadarDot[] = [];
  private static readonly EMPTY_RADAR: RadarDot[] = [];

  private running = false;
  private paused = false;
  private over = false;
  private lastT = 0;
  private raf = 0;
  private hudT = 0;
  private disposed = false;

  public sound: Sound;

  private canvasEl: HTMLCanvasElement;

  private computeOptimalDpr(w: number, h: number): number {
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    const isTouch = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
    if (!isTouch) return rawDpr;
    // На мобильных устройствах и планшетах ограничиваем DPR до 1.65 и пиксельный бюджет (~1.75 Мп):
    // вместе с аппаратным MSAA это даёт чёткую картинку без перегрева и без рывков fill-rate GPU.
    const budgetDpr = Math.sqrt(1_750_000 / Math.max(1, w * h));
    return Math.max(1.1, Math.min(rawDpr, 1.65, +budgetDpr.toFixed(2)));
  }

  private updateCameraFraming(w: number, h: number) {
    const aspect = w / Math.max(1, h);
    const isTouch = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
    if (isTouch || aspect < 1.2) {
      // На мобильных устройствах и планшетах отдаляем камеру назад, чтобы тоннель не обрезался по краям и обзор был шире
      if (aspect < 1) {
        this.baseCamZ = 8.4 + Math.min(1.3, (1 - aspect) * 1.85);
        this.baseCamY = 0.9;
        this.baseFov = 78 + Math.min(6, (1 - aspect) * 9);
      } else {
        this.baseCamZ = 8.25;
        this.baseCamY = 0.86;
        this.baseFov = 78;
      }
    } else {
      this.baseCamZ = 7.0;
      this.baseCamY = 0.8;
      this.baseFov = 75;
    }
  }

  constructor(
    canvas: HTMLCanvasElement,
    private callbacks: {
      onHud: (h: HudState) => void;
      onGameOver: (r: GameResult) => void;
      onPopup?: (text: string, color: string, big: boolean) => void;
    }
  ) {
    const w0 = window.innerWidth;
    const h0 = window.innerHeight;
    this.maxDpr = this.computeOptimalDpr(w0, h0);
    this.curDpr = this.maxDpr;
    this.updateCameraFraming(w0, h0);

    // MSAA включён всегда + умная плотность пикселей — без «лесенки» на кромках и без лагов на больших планшетах
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setPixelRatio(this.curDpr);
    renderer.setSize(w0, h0, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1933);
    this.fog = new THREE.FogExp2(0x0d1933, 0.0074 * FOG_K);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(this.baseFov, w0 / Math.max(1, h0), 0.1, 400);
    this.camera.position.set(0, this.baseCamY, this.baseCamZ);
    this.camera.lookAt(0, -0.9, -20);

    this.glowTex = makeGlowTexture();
    this.glintTex = makeDispersingGlintTexture();
    this.darkTex = makeDarkHaloTexture();
    this.assets = this.buildSharedAssets();

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.ambient = new THREE.AmbientLight(0x8eaaf2, 1.25);
    this.scene.add(this.ambient);

    // Мягкий направленный свет вдоль оси тоннеля — повышает читаемость вдали без яркого пятна в конце
    const tunnelDirLight = new THREE.DirectionalLight(0xdce8ff, 0.48);
    tunnelDirLight.position.set(0, 2, 12);
    tunnelDirLight.target.position.set(0, -1, -180);
    this.scene.add(tunnelDirLight, tunnelDirLight.target);

    // --- Индивидуальный задний фон каждого тоннеля высокого разрешения ---
    this.skyDome = createSkyDome();
    this.scene.add(this.skyDome.mesh);

    this.space = new THREE.Group();
    this.space.renderOrder = -15;
    this.scene.add(this.space);

    const starTex = makeStarTexture();
    // Генерируем звёзды строго вне конуса конца тоннеля (sin(b) >= 0.45), чтобы в конце тоннеля не было скопления звёзд
    const samplePeripheralStar = (rMin: number, rSpan: number): [number, number, number] => {
      const r = rMin + Math.random() * rSpan;
      const a = Math.random() * Math.PI * 2;
      let b = Math.acos(2 * Math.random() - 1);
      if (Math.sin(b) < 0.46) {
        b = b < Math.PI / 2 ? 0.46 + Math.random() * 0.45 : Math.PI - (0.46 + Math.random() * 0.45);
      }
      return [r * Math.sin(b) * Math.cos(a), r * Math.sin(b) * Math.sin(a), r * Math.cos(b)];
    };

    const SN = 420;
    const sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const [sx, sy, sz] = samplePeripheralStar(110, 120);
      sp[i * 3] = sx;
      sp[i * 3 + 1] = sy;
      sp[i * 3 + 2] = sz;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starA = new THREE.PointsMaterial({
      map: starTex,
      size: 1.7,
      sizeAttenuation: false,
      color: 0xc9dbff,
      transparent: true,
      opacity: 0.62,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const SNB = 140;
    const spB = new Float32Array(SNB * 3);
    for (let i = 0; i < SNB; i++) {
      const [sx, sy, sz] = samplePeripheralStar(115, 110);
      spB[i * 3] = sx;
      spB[i * 3 + 1] = sy;
      spB[i * 3 + 2] = sz;
    }
    const starGeoB = new THREE.BufferGeometry();
    starGeoB.setAttribute('position', new THREE.BufferAttribute(spB, 3));
    const starB = new THREE.PointsMaterial({
      map: starTex,
      size: 2.8,
      sizeAttenuation: false,
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.32,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ptsA = new THREE.Points(starGeo, starA);
    const ptsB = new THREE.Points(starGeoB, starB);
    ptsA.renderOrder = -15;
    ptsB.renderOrder = -15;
    ptsB.rotation.set(0.7, 1.9, 0.3);
    this.space.add(ptsA, ptsB);
    this.starPoints.push(ptsA, ptsB);

    this.starMatA = starA;
    this.starMatB = starB;

    // --- Обшивка тоннеля (полупрозрачная поверх фона SkyDome, но на ~35% менее прозрачная чем прежде) ---
    const wallGeo = new THREE.CylinderGeometry(TUNNEL_R + 0.4, TUNNEL_R + 0.4, WALL_LEN, 64, 1, true);
    wallGeo.rotateX(Math.PI / 2);
    const wallTex = this.wallTexture(this.theme);
    this.wallMat = new THREE.MeshBasicMaterial({
      map: wallTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    });
    this.wall = new THREE.Mesh(wallGeo, this.wallMat);
    this.wall.position.z = WALL_Z;
    this.wall.renderOrder = -1;
    this.world.add(this.wall);

    // Живые линии и перелив на стенах тоннеля
    this.tunnelFx = createTunnelFx(TUNNEL_R + 0.3, WALL_LEN, WALL_Z);
    this.tunnelFx.setLook(this.theme.look);
    this.world.add(this.tunnelFx.mesh);

    // Продольные направляющие лучи — 2 меша, число и толщина зависят от тоннеля
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x5f8cff, transparent: true, opacity: 0.3, fog: true });
    this.strutMat = new THREE.MeshBasicMaterial({ color: 0x3c4f9e, transparent: true, opacity: 0.32, fog: true });
    this.rebuildBeams(this.theme.look.beams.count, this.theme.look.beams.width);

    // Важные лучи: тонкая линия строго под игроком (сцена не вращается — игрок всегда внизу)
    // и линии к двум ближайшим угрозам (живут в мире и стоят на угле препятствия)
    this.guideGeo = new THREE.BoxGeometry(0.03, 0.03, WALL_LEN);
    this.guideGeo.translate(TUNNEL_R + 0.0, 0, WALL_Z);
    this.guidePlayerMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.2, depthWrite: false, fog: true });
    this.guideThreatMat = new THREE.MeshBasicMaterial({ color: 0x9c2542, transparent: true, opacity: 0.3, depthWrite: false, fog: true });
    this.guidePlayer = new THREE.Mesh(this.guideGeo, this.guidePlayerMat);
    this.guidePlayer.rotation.z = -Math.PI / 2;
    this.guidePlayer.visible = false;
    this.guidePlayer.frustumCulled = false;
    this.scene.add(this.guidePlayer);
    for (let i = 0; i < 2; i++) {
      const gm = new THREE.Mesh(this.guideGeo, this.guideThreatMat);
      gm.visible = false;
      gm.frustumCulled = false;
      this.world.add(gm);
      this.guideThreats.push(gm);
    }

    // Пол-дорожка + боковые перила (перила объединены в 1 меш)
    const runTex = makeRunwayTexture();
    runTex.repeat.set(1, 20);
    this.runwayMat = new THREE.MeshBasicMaterial({
      map: runTex,
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const runGeo = new THREE.CylinderGeometry(TUNNEL_R - 0.04, TUNNEL_R - 0.04, 420, 16, 1, true, -Math.PI / 2 - 0.17, 0.34);
    runGeo.rotateX(Math.PI / 2);
    this.runway = new THREE.Mesh(runGeo, this.runwayMat);
    this.runway.position.z = -170;
    this.world.add(this.runway);

    this.railMat = new THREE.MeshBasicMaterial({ color: 0x6ef7d8, transparent: true, opacity: 0.24 });
    const railGeos: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const rg = new THREE.BoxGeometry(0.04, 0.04, 420);
      const a = -Math.PI / 2 + side * 0.42;
      rg.rotateZ(a);
      rg.translate(Math.cos(a) * (TUNNEL_R - 0.02), Math.sin(a) * (TUNNEL_R - 0.02), -170);
      railGeos.push(rg);
    }
    this.world.add(new THREE.Mesh(mergeSimpleGeometries(railGeos), this.railMat));

    // Внешние шпангоуты — сшиты в 1 меш вместо 8
    const strutGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const sg = new THREE.TorusGeometry(TUNNEL_R + 1.05, 0.05, 4, 64);
      sg.translate(0, 0, -i * 92);
      strutGeos.push(sg);
    }
    this.strutOuter = new THREE.MeshBasicMaterial({ color: 0x35488f, transparent: true, opacity: 0.2 });
    this.world.add(new THREE.Mesh(mergeSimpleGeometries(strutGeos), this.strutOuter));

    // Рёбра тоннеля: группы-слоты по 8 м; состав каждого слота задаёт ритм выбранного тоннеля
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = new THREE.Group();
      ring.position.z = (1 - i) * RING_GAP;
      this.world.add(ring);
      this.rings.push(ring);
    }
    this.rebuildRibs();

    // Ядро в конце тоннеля (на оси, внутри обшивки — не перекрывает объекты)
    this.raysTex = makeRaysTexture();
    this.ringTex = makeThinRingTexture();
    const mkCore = (tex: THREE.Texture) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
      );
      sp.position.set(0, 0, -110);
      this.scene.add(sp);
      return sp;
    };
    this.coreGlow = mkCore(this.glowTex);
    this.coreRays = mkCore(this.raysTex);
    this.coreRing = mkCore(this.ringTex);

    // Линии скорости
    const N = 110;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = TUNNEL_R - 0.35 - Math.random() * 0.5;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = 15 - Math.random() * 260;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.streakMat = new THREE.PointsMaterial({
      map: this.glowTex,
      color: 0xffb03a,
      size: 0.15,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    streakGeo.setDrawRange(0, 36); // линий скорости втрое меньше — меньше шума
    this.streaks = new THREE.Points(streakGeo, this.streakMat);
    this.world.add(this.streaks);

    // Пылинки в туннеле
    const DN = 96;
    const dpos = new Float32Array(DN * 3);
    for (let i = 0; i < DN; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * (TUNNEL_R - 1.1);
      dpos[i * 3] = Math.cos(a) * r;
      dpos[i * 3 + 1] = Math.sin(a) * r;
      dpos[i * 3 + 2] = 12 - Math.random() * 260;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(DN * 3).fill(1), 3));
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        map: this.glowTex,
        color: 0xffffff,
        vertexColors: true,
        size: 0.1,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    this.world.add(this.dust);

    // --- Главная искра игрока (многослойные текстурированные скины) ---
    this.player = new THREE.Group();
    this.player.position.set(0, -PLAYER_R, 0);
    this.player.scale.setScalar(PLAYER_SCALE);
    this.scene.add(this.player);

    this.sparkRig = buildSparkRig(this.skin);
    this.player.add(this.sparkRig.group);

    this.playerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.sparkRig.coronaTex,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.playerGlow.scale.setScalar(3.1);
    this.playerGlow.center.set(0.5, 0.5);
    this.player.add(this.playerGlow);

    this.auraMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.028, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.player.add(this.auraMesh);

    this.playerLight = new THREE.PointLight(this.skin.light, 46, 98, 1.25);
    this.player.add(this.playerLight);

    // Щит: тонкий стеклянный пузырь + два лёгких кольца-орбиты (без каркаса и тяжёлого свечения)
    this.shieldGroup = new THREE.Group();
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xcfd3d9, transparent: true, opacity: 0.06, depthWrite: false });
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.98, 32, 24), bubbleMat);
    // экваториальный контур пузыря — всегда повёрнут к камере, даёт чистый силуэт
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.014, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0xe3e6ea, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const gyroA = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.011, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0xf3f4f6, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    gyroA.rotation.x = Math.PI / 2.2;
    const gyroB = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.008, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0xb4bac2, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    gyroB.rotation.y = Math.PI / 3;
    const shieldGlow = this.glowSprite(0xc9ced5, 2.3, 0.2);
    this.shieldGroup.add(bubble, rim, gyroA, gyroB, shieldGlow);
    this.shieldGroup.visible = false;
    this.player.add(this.shieldGroup);
    this.shieldMats = [
      { mat: bubbleMat, base: 0.06 },
      { mat: rim.material as THREE.Material, base: 0.5 },
      { mat: gyroA.material as THREE.Material, base: 0.55 },
      { mat: gyroB.material as THREE.Material, base: 0.35 },
      { mat: shieldGlow.material as THREE.Material, base: 0.2 },
    ];

    // Магнит: два тонких кольца-орбиты и пара коротких дуг, без жирных линий
    this.magnetGroup = new THREE.Group();
    const mRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.014, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mRing1.rotation.x = 1.1;
    const mRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.009, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0x8b62ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mRing2.rotation.x = -0.6;
    this.magnetGroup.add(mRing1, mRing2);
    for (let i = 0; i < 2; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(1.06, 0.014, 5, 24, Math.PI * 0.4),
        new THREE.MeshBasicMaterial({ color: 0xd4b8ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      arc.rotation.set(i * 1.6, i * 2.6, i * 0.7);
      this.magnetGroup.add(arc);
      this.magnetArcs.push(arc);
    }
    this.magnetGroup.visible = false;
    this.player.add(this.magnetGroup);

    // Шлейф за искрой: цепочка мягких огоньков, которая тянется за героем при смещении по кругу
    for (let i = 0; i < TRAIL_N; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: this.skin.trail,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      s.scale.setScalar((1.0 - (i / TRAIL_N) * 0.72) * PLAYER_SCALE);
      s.visible = false;
      this.scene.add(s);
      this.trail.push(s);
      this.trailAng.push(0);
    }

    // Метеорный хвост под искрой: мягкие звенья, сужающиеся к концу (виден только в забеге)
    for (let i = 0; i < TAIL_N; i++) {
      const t = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: this.skin.trail,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      t.visible = false;
      t.renderOrder = 3;
      this.scene.add(t);
      this.tail.push(t);
    }

    // «Пепельный оберег»: одно тонкое кольцо и четыре риски — без свечения и объёма
    this.wardenGroup = new THREE.Group();
    const wardenMat = (base: number) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe3d5ad, transparent: true, opacity: base, depthWrite: false });
      this.wardenMats.push({ mat, base });
      return mat;
    };
    const wRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.013, 6, 96), wardenMat(0.6));
    const tickGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const tg = new THREE.BoxGeometry(0.026, 0.15, 0.01);
      tg.translate(0, 0.9, 0);
      tg.rotateZ((i * Math.PI) / 2);
      tickGeos.push(tg);
    }
    this.wardenTicks = new THREE.Mesh(mergeSimpleGeometries(tickGeos), wardenMat(0.85));
    this.wardenGroup.add(wRing, this.wardenTicks);
    this.wardenGroup.visible = false;
    this.player.add(this.wardenGroup);

    // Эффекты тоннеля «Нулевая точка» (видны только в нём)
    const waveGeo = new THREE.TorusGeometry(TUNNEL_R - 0.08, 0.02, 5, 128);
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(
        waveGeo,
        new THREE.MeshBasicMaterial({ color: 0xdce2ed, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      w.position.z = -i * 70;
      w.visible = false;
      this.scene.add(w);
      this.zeroWaves.push(w);
    }
    const rippleGeo = new THREE.RingGeometry(0.92, 1, 56);
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        rippleGeo,
        new THREE.MeshBasicMaterial({ color: 0xe9ecf2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.zeroRipples.push({ mesh, t: 1 });
    }

    // Пул стилизованных компактных 3D-анимаций взаимодействия со светлячками, баффами и препятствиями
    const burstSmoothGeo = new THREE.RingGeometry(0.82, 1.0, 40);
    const burstFacetGeo = new THREE.RingGeometry(0.84, 1.0, 8);
    const burstStarGeo = new THREE.RingGeometry(0.66, 0.94, 6);
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const mkBurstMat = () =>
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      const matA = mkBurstMat();
      const matB = mkBurstMat();
      const matC = mkBurstMat();
      const ringA = new THREE.Mesh(burstSmoothGeo, matA);
      const ringB = new THREE.Mesh(burstFacetGeo, matB);
      const ringC = new THREE.Mesh(burstStarGeo, matC);
      group.add(ringA, ringB, ringC);
      group.visible = false;
      this.scene.add(group);
      this.themeBursts.push({
        group,
        ringA,
        ringB,
        ringC,
        matA,
        matB,
        matC,
        colA: 0xffffff,
        colB: 0xffffff,
        colC: 0xffffff,
        t: 1,
        dur: 0.5,
        style: 'pulse',
        kind: 'orb',
      });
    }

    // Пул частиц (увеличен для красивых тематических всплесков)
    for (let i = 0; i < 96; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      s.visible = false;
      s.scale.setScalar(0.5);
      this.scene.add(s);
      this.particles.push({ sprite: s, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }

    this.canvasEl = canvas;
    this.sound = new Sound();
    this.bindEvents(canvas);
    this.setTheme(this.theme.id);
    this.prewarmPoolAndShaders();
    renderer.render(this.scene, this.camera);
    this.lastT = performance.now();
    this.loop(this.lastT);
  }

  /**
   * Заранее создаёт пул игровых объектов и компилирует все WebGL-шейдеры на этапе загрузки,
   * чтобы во время забега появление первой лазерной стенки, охотника или баффа не вызывало фризов.
   */
  private prewarmPoolAndShaders() {
    const warmupCounts: [Kind, number][] = [
      ['orb', 18],
      ['shard', 14],
      ['hunter', 6],
      ['wall', 3],
      ['flash', 2],
      ['magnet', 2],
      ['shield', 2],
      ['overcharge', 2],
    ];
    const created: Entity[] = [];
    for (const [kind, count] of warmupCounts) {
      for (let i = 0; i < count; i++) {
        const { mesh, radius, spinner, shadow, glints } = this.createEntityMesh(kind);
        mesh.position.set(0, 0, -60);
        mesh.visible = i === 0; // по одному экземпляру каждого типа оставляем видимым для компиляции шейдеров
        const e: Entity = {
          mesh,
          kind,
          angle: -Math.PI / 2,
          z: -60,
          alive: false,
          spin: 0,
          radius,
          missed: false,
          dir: 1,
          spinner,
          shadow,
          glints,
        };
        created.push(e);
      }
    }
    this.shieldGroup.visible = true;
    this.magnetGroup.visible = true;
    this.wardenGroup.visible = true;
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {
      /* ignore */
    }
    this.shieldGroup.visible = false;
    this.magnetGroup.visible = false;
    this.wardenGroup.visible = false;
    for (const e of created) {
      this.recycleEntity(e);
    }
  }

  /** Общие геометрии и материалы всех объектов тоннеля — создаются 1 раз. */
  private buildSharedAssets(): SharedEntityAssets {
    const shardGeo = new THREE.OctahedronGeometry(0.8, 0);
    const shardEdges = new THREE.EdgesGeometry(shardGeo);
    const shardEdgesGeo = tubesFromEdges(shardEdges, 0.026);
    const shardRimGeo = tubesFromEdges(shardEdges, 0.075);
    shardEdges.dispose();

    const boltGeo = makeBoltGeometry();
    const boltEdgesGeo = new THREE.EdgesGeometry(boltGeo, 30);

    // Препятствия (Shard и Hunter) в едином стиле со стенками:
    // гладкое ядро + 6 шипов по осям (с шейдером внутреннего перелива стенки),
    // тёмный контур вокруг ядра и шипов, рельефные пояса-манжеты и двойная неоновая кромка
    const spikeParts: THREE.BufferGeometry[] = [];
    const outlineParts: THREE.BufferGeometry[] = [new THREE.IcosahedronGeometry(0.38 * 1.15, 2)];
    const beltParts: THREE.BufferGeometry[] = [new THREE.TorusGeometry(0.388, 0.022, 6, 48)];
    const tipParts: THREE.BufferGeometry[] = [];
    const tipSoftParts: THREE.BufferGeometry[] = [];
    const axes: [number, number, number][] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (const [ax, ay, az] of axes) {
      const v = new THREE.Vector3(ax, ay, az).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);

      const cone = new THREE.ConeGeometry(0.072, 0.34, 14, 1);
      cone.translate(0, 0.17 + 0.35, 0);
      cone.applyQuaternion(q);
      spikeParts.push(cone);

      const coneOutline = new THREE.ConeGeometry(0.094, 0.37, 10, 1);
      coneOutline.translate(0, 0.17 + 0.35, 0);
      coneOutline.applyQuaternion(q);
      outlineParts.push(coneOutline);

      const collar = new THREE.TorusGeometry(0.074, 0.017, 6, 18);
      collar.rotateX(Math.PI / 2);
      collar.translate(0, 0.365, 0);
      collar.applyQuaternion(q);
      beltParts.push(collar);

      const tip = new THREE.SphereGeometry(0.034, 8, 6);
      tip.translate(0, 0.7, 0);
      tip.applyQuaternion(q);
      tipParts.push(tip);

      const tipSoft = new THREE.SphereGeometry(0.064, 8, 6);
      tipSoft.translate(0, 0.7, 0);
      tipSoft.applyQuaternion(q);
      tipSoftParts.push(tipSoft);
    }
    const hunterSpikeGeo = mergeSimpleGeometries(spikeParts);
    const hunterOutlineGeo = mergeSimpleGeometries(outlineParts);
    const hunterBeltGeo = mergeSimpleGeometries(beltParts);
    const hunterTipGeo = mergeSimpleGeometries(tipParts);
    const hunterTipSoftGeo = mergeSimpleGeometries(tipSoftParts);
    const hunterCoreGeo = new THREE.IcosahedronGeometry(0.38, 3);
    const shieldGeo = makeShieldGeometry(0, 0.16);
    const shieldPlateGeo = makeShieldGeometry(0.2, 0.05);
    shieldPlateGeo.translate(0, 0, 0.105);
    const shieldEmblemGeo = makeShieldEmblemGeometry();
    shieldEmblemGeo.translate(0, 0, 0.155);

    const mkGlowMat = (color: number, opacity = 1) =>
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

    return {
      // Светлячок — чистый тёплый огонёк (легковесное ядро + мягкий золотой ореол)
      orbCoreGeo: new THREE.SphereGeometry(0.15, 16, 12),
      orbCoreMat: new THREE.MeshBasicMaterial({ color: 0xfff9e6 }),
      orbGlowMat: mkGlowMat(0xffd678, 0.95),

      shardGeo,
      shardMat: new THREE.MeshPhongMaterial({ color: HAZARD_NORMAL.shardBody, emissive: HAZARD_NORMAL.shardEm, emissiveIntensity: 0.92, specular: 0xffffff, shininess: 95 }),
      shardOutlineGeo: new THREE.OctahedronGeometry(0.8 * 1.15, 0),
      shardOutlineMat: new THREE.MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false }),
      shardEdgesGeo,
      shardEdgeMat: new THREE.MeshBasicMaterial({ color: HAZARD_NORMAL.shardEdge }),
      shardRimGeo,
      shardRimMat: new THREE.MeshBasicMaterial({ color: HAZARD_NORMAL.shardEdge, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
      shardGlowMat: mkGlowMat(HAZARD_NORMAL.shardGlow, 0.0),

      boltGeo,
      boltMat: new THREE.MeshBasicMaterial({ color: 0xfff8c9 }),
      boltEdgesGeo,
      boltEdgeMat: new THREE.LineBasicMaterial({ color: 0xe6c64a }),
      flashRingGeo: new THREE.TorusGeometry(0.78, 0.022, 5, 56),
      flashRingMat: new THREE.MeshBasicMaterial({ color: 0xfff09a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
      flashGlowMat: mkGlowMat(0xfff2a0, 1),

      magnetUGeo: new THREE.TorusGeometry(0.4, 0.13, 12, 32, Math.PI),
      magnetUMat: new THREE.MeshLambertMaterial({ color: 0x8b62ff, emissive: 0x6a3cf0, emissiveIntensity: 1.05 }),
      magnetTipGeo: new THREE.CylinderGeometry(0.15, 0.15, 0.24, 16),
      magnetTipMat: new THREE.MeshLambertMaterial({ color: 0xe8ecff, emissive: 0xc3aaff, emissiveIntensity: 0.85 }),
      magnetGlowMat: mkGlowMat(0xc3aaff, 1),

      hunterCoreGeo,
      hunterCoreMat: new THREE.MeshPhongMaterial({
        color: HAZARD_NORMAL.huntBody,
        emissive: HAZARD_NORMAL.huntEm,
        emissiveIntensity: 0.92,
        specular: 0xffffff,
        shininess: 110,
      }),
      hunterOutlineGeo,
      hunterSpikeGeo,
      hunterSpikeMat: new THREE.MeshPhongMaterial({
        color: HAZARD_NORMAL.huntBody,
        emissive: HAZARD_NORMAL.huntEm,
        emissiveIntensity: 0.88,
        specular: 0xffffff,
        shininess: 100,
      }),
      // Вокруг препятствий тонкое неоновое колечко с мягким свечением кромки (в стиле стенки)
      hunterRingGeo: new THREE.TorusGeometry(0.74, 0.019, 6, 64),
      hunterRingSoftGeo: new THREE.TorusGeometry(0.74, 0.048, 6, 64),
      hunterRingMat: new THREE.MeshBasicMaterial({ color: HAZARD_NORMAL.huntLeg, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      hunterGlowMat: mkGlowMat(HAZARD_NORMAL.huntGlow, 0.0),
      hunterRimGeo: new THREE.IcosahedronGeometry(0.38 * 1.12, 2),
      hunterBeltGeo,
      hunterBeltMat: new THREE.MeshPhongMaterial({ color: 0x5a1426, emissive: HAZARD_NORMAL.huntLeg, emissiveIntensity: 0.3, specular: 0xffffff, shininess: 120 }),
      hunterTipGeo,
      hunterTipSoftGeo,
      hunterTipMat: new THREE.MeshBasicMaterial({ color: HAZARD_NORMAL.wallRim, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      rimMat: makeRimMaterial(HAZARD_NORMAL.huntLeg),

      battBodyGeo: new THREE.BoxGeometry(1.0, 0.56, 0.3),
      battBodyMat: new THREE.MeshLambertMaterial({ color: 0x0c3412, emissive: 0x1d8a36, emissiveIntensity: 0.65 }),
      battTipGeo: new THREE.BoxGeometry(0.11, 0.24, 0.2),
      battTipMat: new THREE.MeshBasicMaterial({ color: 0xd6ffe0 }),
      battBarGeo: new THREE.BoxGeometry(0.2, 0.34, 0.06),
      battBarMat: new THREE.MeshBasicMaterial({ color: 0x8dff6a }),
      battEdgesGeo: new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 0.56, 0.3)),
      battEdgeMat: new THREE.LineBasicMaterial({ color: 0xb6ffa0 }),
      overGlowMat: mkGlowMat(0x7dff6a, 1),

      shieldBodyGeo: shieldGeo,
      shieldBodyMat: new THREE.MeshPhongMaterial({ color: 0x59606a, emissive: 0x8d949e, emissiveIntensity: 0.7, specular: 0xffffff, shininess: 90 }),
      shieldPlateGeo,
      shieldPlateMat: new THREE.MeshBasicMaterial({ color: 0xcfd3d9 }),
      shieldEmblemGeo,
      shieldEmblemMat: new THREE.MeshBasicMaterial({ color: 0x4b5058, side: THREE.DoubleSide }),
      shieldEdgesGeo: new THREE.EdgesGeometry(shieldGeo, 40),
      shieldEdgeMat: new THREE.LineBasicMaterial({ color: 0xf1f3f5 }),
      shieldRingGeo: new THREE.TorusGeometry(0.98, 0.018, 5, 64),
      shieldRingMat: new THREE.MeshBasicMaterial({ color: 0xdfe3e8, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
      shieldGlowMat: mkGlowMat(0xc9ced5, 0.7),

      wallArcGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14, 0.42 * OBST_SCALE, 10, 56, WALL_ARC),
      wallArcMat: makeWallArcMaterial(),
      // тонкая светящаяся кромка: гребень арки + кольца на торцах (объединены в 1 буфер для снижения draw calls)
      wallRimGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14 - 0.42 * OBST_SCALE, 0.03, 5, 56, WALL_ARC),
      wallRimMergedGeo: (() => {
        const R = TUNNEL_R - 0.14;
        const rimParts: THREE.BufferGeometry[] = [new THREE.TorusGeometry(R - 0.42 * OBST_SCALE, 0.03, 5, 56, WALL_ARC)];
        for (const ang of [0, WALL_ARC]) {
          const endG = new THREE.TorusGeometry(0.42 * OBST_SCALE, 0.03, 5, 24);
          endG.rotateX(Math.PI / 2);
          endG.rotateZ(ang);
          endG.translate(Math.cos(ang) * R, Math.sin(ang) * R, 0);
          rimParts.push(endG);
        }
        return mergeSimpleGeometries(rimParts);
      })(),
      wallRimMat: new THREE.MeshBasicMaterial({
        color: HAZARD_NORMAL.wallRim,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      wallRimSoftMat: new THREE.MeshBasicMaterial({ color: HAZARD_NORMAL.wallRim, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
      wallGlowMat: mkGlowMat(HAZARD_NORMAL.wallGlow, 0.28),
      wallCrestGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14 - 0.42 * OBST_SCALE, 0.07, 5, 56, WALL_ARC),
      wallEndGeo: new THREE.TorusGeometry(0.42 * OBST_SCALE, 0.03, 5, 24),
      wallOutlineGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14, 0.6 * OBST_SCALE, 10, 56, WALL_ARC),
      wallOutlineMat: new THREE.MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.5, side: THREE.BackSide, depthWrite: false }),
      wallShellGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14, 0.42 * OBST_SCALE * 1.2, 10, 56, WALL_ARC),
      wallBandGeo: new THREE.TorusGeometry(0.42 * OBST_SCALE * 1.03, 0.028, 6, 20),
      wallBandsMergedGeo: (() => {
        const RB = TUNNEL_R - 0.14;
        const bands = 5;
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 1; i <= bands; i++) {
          const ang = (WALL_ARC * i) / (bands + 1);
          const bg = new THREE.TorusGeometry(0.42 * OBST_SCALE * 1.03, 0.028, 6, 20);
          bg.rotateX(Math.PI / 2);
          bg.rotateZ(ang);
          bg.translate(Math.cos(ang) * RB, Math.sin(ang) * RB, 0);
          parts.push(bg);
        }
        const merged = mergeSimpleGeometries(parts);
        merged.computeVertexNormals();
        return merged;
      })(),
      wallBandMat: new THREE.MeshPhongMaterial({ color: 0x5a1426, emissive: HAZARD_NORMAL.wallRim, emissiveIntensity: 0.3, specular: 0xffffff, shininess: 120 }),
      glintMat: new THREE.SpriteMaterial({
        map: this.glintTex,
        color: 0xffb8cf,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      haloMat: new THREE.SpriteMaterial({ map: this.darkTex, transparent: true, opacity: 0.42, depthWrite: false }),
      haloSoftMat: new THREE.SpriteMaterial({ map: this.darkTex, transparent: true, opacity: 0.4, depthWrite: false }),
      shadowGeo: new THREE.PlaneGeometry(3.6, 2.1),
      shadowMat: new THREE.MeshBasicMaterial({ map: this.darkTex, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    };
  }

  // ---------------- Ввод ----------------
  public setTouchDir(dir: -1 | 0 | 1) {
    this.touchDir = dir;
  }

  /** Приостанавливает фоновый рендер основной сцены, когда поверх открыт полноэкранный магазин/3D-осмотр. */
  public setOverlayOpen(open: boolean) {
    if (this.overlayOpen === open) return;
    this.overlayOpen = open;
    if (!open) {
      this.lastT = performance.now();
      this.needsStaticRender = true;
    }
  }

  private clearInputState = () => {
    this.leftHeld = false;
    this.rightHeld = false;
    this.keyDir = 0;
    this.touchDir = 0;
    this.steerVel = 0;
    this.dragging = false;
    this.pointerId = -1;
  };
  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.updateCameraFraming(w, h);
    this.camera.aspect = w / Math.max(1, h);
    if (!this.running) {
      this.camera.fov = this.baseFov;
      this.camera.position.set(0, this.baseCamY, this.baseCamZ);
    }
    this.camera.updateProjectionMatrix();
    this.maxDpr = this.computeOptimalDpr(w, h);
    this.curDpr = Math.min(this.curDpr, this.maxDpr);
    this.renderer.setPixelRatio(this.curDpr);
    this.renderer.setSize(w, h, false);
    this.needsStaticRender = true;
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.leftHeld = true;
      this.keyDir = -1;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.rightHeld = true;
      this.keyDir = 1;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.leftHeld = false;
      this.keyDir = this.rightHeld ? 1 : 0;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.rightHeld = false;
      this.keyDir = this.leftHeld ? -1 : 0;
    }
  };
  private onPointerDown = (e: PointerEvent) => {
    if (this.dragging && this.pointerId !== -1) return;
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.lastPointerX = e.clientX;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const rawDx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    if (!this.running || this.paused || this.over) return;
    const dx = Math.max(-120, Math.min(120, rawDx));
    this.targetAngle += (dx / Math.max(320, window.innerWidth)) * 6.2;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId !== -1 && e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = -1;
  };

  private bindEvents(canvas: HTMLCanvasElement) {
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('blur', this.clearInputState);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });
  }

  // ---------------- API ----------------
  start(fx?: LoadoutFx) {
    this.fx = fx ?? emptyFx();
    this.sound.resume();
    this.reset();
    this.running = true;
    this.paused = false;
    this.over = false;
    this.absorb = this.skin.absorbOnce;
    this.wardenCharges = this.fx.warden ? 1 : 0;
    this.magnetDur = this.skin.magnetDur * 0.94 + this.fx.extraMagnet;
    if (this.fx.startShield || this.skin.startShield) this.setShield(true);
    this.sound.startDrone();
    this.pushHud();
  }

  pause() {
    if (!this.running || this.over) return;
    this.clearInputState();
    this.paused = true;
    this.needsStaticRender = true;
    this.sound.stopDrone();
  }

  resume() {
    if (!this.running || this.over) return;
    this.clearInputState();
    this.paused = false;
    this.lastT = performance.now();
    this.sound.resume();
    this.sound.startDrone();
  }

  get isRunning() {
    return this.running;
  }

  stopToMenu() {
    this.clearInputState();
    this.running = false;
    this.paused = false;
    this.over = false;
    this.light = MAX_LIGHT;
    this.fog.density = this.fogBase;
    this.ambient.intensity = 0.6 * this.ambK;
    this.setShield(false);
    this.shieldBreakT = 0;
    this.magnetGroup.visible = false;
    this.wardenGroup.visible = false;
    this.wardenBreakT = 0;
    this.tail.forEach((t) => (t.visible = false));
    this.sound.stopDrone();
  }

  revive() {
    this.clearInputState();
    this.light = 72;
    this.combo = 0;
    this.comboT = 0;
    this.setShield(true);
    for (const e of this.entities) {
      if (e.alive && (e.kind === 'shard' || e.kind === 'wall' || e.kind === 'hunter') && e.z > -75) {
        this.kill(e);
      }
    }
    this.over = false;
    this.running = true;
    this.paused = false;
    this.lastT = performance.now();
    this.flashFx = 1;
    this.sound.resume();
    this.sound.startDrone();
    this.sound.powerup();
    this.pushHud();
  }

  private wallTexture(t: Theme): THREE.Texture {
    let tex = this.wallCache.get(t.id);
    if (!tex) {
      const aniso = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
      tex = paintWallTexture(t.look, t.wall, WALL_LEN / WALL_TILE, aniso);
      this.wallCache.set(t.id, tex);
    }
    return tex;
  }

  /** Лучи «важного»: под игроком и к двум ближайшим впереди угрозам (мины/охотники). */
  private updateGuides(k: number) {
    this.guidePlayer.visible = true;
    this.guidePlayerMat.opacity = 0.14 + 0.1 * k;
    let n1: Entity | null = null;
    let n2: Entity | null = null;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive || (e.kind !== 'shard' && e.kind !== 'hunter')) continue;
      if (e.z > -6 || e.z < -105) continue;
      if (!n1 || e.z > n1.z) {
        n2 = n1;
        n1 = e;
      } else if (!n2 || e.z > n2.z) {
        n2 = e;
      }
    }
    const list = [n1, n2];
    for (let i = 0; i < this.guideThreats.length; i++) {
      const e = list[i];
      const g = this.guideThreats[i];
      g.visible = !!e;
      if (e) g.rotation.z = this.effAngleOf(e);
    }
    this.guideThreatMat.opacity = 0.18 + 0.14 * k;
  }

  /** Пересобирает продольные лучи под число и толщину выбранного тоннеля (2 меша). */
  private rebuildBeams(count: number, width: number) {
    for (const m of this.beamMeshes) {
      this.world.remove(m);
      m.geometry.dispose();
    }
    this.beamMeshes = [];
    const even: THREE.BufferGeometry[] = [];
    const odd: THREE.BufferGeometry[] = [];
    let n = 0;
    for (let i = 0; i < count; i++) {
      const a = beamAngle(i, count);
      // не рисуем лучи у пола — там дорожка и перила
      const fromFloor = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
      if (fromFloor < 0.75) continue;
      const bg = new THREE.BoxGeometry(width * 0.75, width * 0.75, WALL_LEN);
      bg.rotateZ(a);
      bg.translate(Math.cos(a) * (TUNNEL_R + 0.02), Math.sin(a) * (TUNNEL_R + 0.02), WALL_Z);
      (n++ % 2 === 0 ? even : odd).push(bg);
    }
    if (even.length) this.beamMeshes.push(new THREE.Mesh(mergeSimpleGeometries(even), this.beamMat));
    if (odd.length) this.beamMeshes.push(new THREE.Mesh(mergeSimpleGeometries(odd), this.strutMat));
    for (const m of this.beamMeshes) this.world.add(m);
  }

  /** Расставляет рёбра по ритму тоннеля: общие геометрии и материалы, 0 лишних материалов на кольцо. */
  private rebuildRibs() {
    const look = this.theme.look;
    disposeRibGeos(this.ribGeos);
    this.ribGeos = buildRibGeos(look, TUNNEL_R);
    for (let i = 0; i < this.rings.length; i++) {
      const g = this.rings[i];
      g.clear();
      const letter = look.ribPattern[i % look.ribPattern.length];
      for (const m of ribPieces(letter, this.ribGeos, this.ribMats)) g.add(m);
    }
  }

  /** Цвета рёбер зависят от запаса света; у «Призмы» кромка переливается. */
  private updateRibLook(k: number) {
    const look = this.theme.look;
    const rc = look.ribColors;
    const m = this.ribMats;
    const e = 0.45 + 0.55 * k;
    m.body.color.setHex(rc.body).multiplyScalar(0.65 + 0.35 * k);
    if (look.hueSway) {
      const sw = look.hueSway;
      const h = sw.from + (sw.to - sw.from) * (0.5 + 0.5 * Math.sin(this.time * sw.speed * 2));
      m.edge.color.setHSL(h, sw.sat ?? 0.9, (sw.light ?? 0.5) * (0.62 + 0.38 * k));
    } else {
      m.edge.color.setHex(rc.edge).multiplyScalar(e);
    }
    m.accent.color.setHex(rc.accent).multiplyScalar(0.4 + 0.6 * k);
    m.dim.color.setHex(rc.dim).multiplyScalar(0.55 + 0.45 * k);
    m.halo.color.copy(m.edge.color);
    m.halo.opacity = look.halo * (0.3 + 0.7 * k) * (this.flowT > 0 ? 1.5 : 1);
  }

  /** Единый внутренний перелив стенок, осколков и мин-охотников и мягкое мерцание огней на концах шипов. */
  private pulseHazards() {
    const A = this.assets;
    A.hunterTipMat.opacity = 0.78 + 0.22 * Math.sin(this.time * 5.2);
    A.rimMat.uniforms.uPulse.value = 0.85 + 0.15 * Math.sin(this.time * 2.4);
    A.wallArcMat.uniforms.uTime.value = this.time;
    A.wallArcMat.uniforms.uFogColor.value.copy(this.fog.color);
    A.wallArcMat.uniforms.uFogDensity.value = this.fog.density;
  }

  /**
   * Очень медленный дрейф звёздного неба: поле поворачивается сразу по трём осям с разной скоростью,
   * поэтому звёзды неторопливо «плывут», как при полёте в открытом космосе (≈2–3 px/с).
   */
  private driftSpace(dt: number) {
    this.space.rotation.z += dt * 0.008;
    const [a, b] = this.starPoints;
    if (a) {
      a.rotation.y += dt * 0.006;
      a.rotation.x += dt * 0.0036;
    }
    if (b) {
      b.rotation.y -= dt * 0.009;
      b.rotation.x += dt * 0.005;
    }
  }

  /** Спокойное ядро в конце тоннеля (без яркого засвечивающего пятна). */
  private updateCore(k: number, dt: number) {
    const c = this.theme.look.core;
    const pulse = 1 + Math.sin(this.time * 1.3) * 0.04;
    const gm = this.coreGlow.material as THREE.SpriteMaterial;
    gm.opacity = c.opacity * 0.45 * (0.45 + 0.55 * k);
    this.coreGlow.scale.setScalar(c.size * pulse);
    const rm = this.coreRays.material as THREE.SpriteMaterial;
    rm.opacity = c.rays * 0.4 * (0.4 + 0.6 * k);
    this.coreRays.visible = c.rays > 0;
    rm.rotation += dt * 0.12;
    const nm = this.coreRing.material as THREE.SpriteMaterial;
    nm.opacity = c.ring * 0.45 * (0.5 + 0.5 * k);
    this.coreRing.visible = c.ring > 0;
    this.coreRing.scale.setScalar(c.size * 0.9 * (1 + Math.sin(this.time * 0.9) * 0.03));
  }

  setTheme(id: string) {
    const t = themeById(id);
    const look = t.look;
    this.theme = t;
    (this.scene.background as THREE.Color).set(t.sky);
    this.fog.color.set(t.fog);
    this.fogBase = look.fog * FOG_K;
    if (!this.running) this.fog.density = this.fogBase;
    this.skyDome.setTheme(look.panel);
    this.wallMat.map = this.wallTexture(t);
    this.wallMat.needsUpdate = true;
    this.beamMat.color.setHex(t.beam);
    this.strutMat.color.setHex(t.strut);
    this.strutOuter.color.setHex(t.strut);
    this.runwayMat.color.setHex(t.runway);
    this.railMat.color.setHex(t.rail);

    // Свет: цвет и сила окружения, множитель света искры
    this.ambient.color.setHex(look.ambient.color);
    this.ambK = look.ambient.intensity;
    this.lightK = look.playerLight;
    if (!this.running) this.ambient.intensity = 0.72 * this.ambK;

    // Умеренные частицы: число, размер, прозрачность и палитра
    const dm = this.dust.material as THREE.PointsMaterial;
    dm.size = look.dust.size * 1.45;
    dm.opacity = look.dust.opacity;
    const dcol = this.dust.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < dcol.count; i++) {
      this.tmpC.setHex(look.dust.colors[i % look.dust.colors.length]);
      dcol.setXYZ(i, this.tmpC.r, this.tmpC.g, this.tmpC.b);
    }
    dcol.needsUpdate = true;
    this.dust.geometry.setDrawRange(0, look.dust.n);
    this.streakMat.color.setHex(look.streak.color);

    // Ядро
    this.tmpC2.setHex(look.core.color);
    (this.coreGlow.material as THREE.SpriteMaterial).color.copy(this.tmpC2);
    (this.coreRays.material as THREE.SpriteMaterial).color.copy(this.tmpC2);

    this.tunnelFx.setLook(look);
    this.rebuildBeams(look.beams.count, look.beams.width);
    this.rebuildRibs();

    this.starMatA?.color.setHex(t.stars);
    this.starMatB?.color.setHex(t.starBright);
    this.themeRich = t.rich;
    this.applyHazardPalette(Boolean(t.warm));
    this.applySkin();
  }

  /** Подбирает цвета препятствий так, чтобы они не сливались с обшивкой текущего тоннеля (в едином стиле со стенками). */
  private applyHazardPalette(cold: boolean) {
    const H = cold ? HAZARD_COLD : HAZARD_NORMAL;
    const A = this.assets;
    A.shardMat.color.setHex(H.shardBody);
    A.shardMat.emissive.setHex(H.shardEm);
    A.shardEdgeMat.color.setHex(H.shardEdge);
    A.shardRimMat.color.setHex(H.shardEdge);
    A.shardGlowMat.color.setHex(H.shardGlow);
    A.wallArcMat.uniforms.uBodyColor.value.setHex(H.wallBody);
    A.wallArcMat.uniforms.uEmissiveColor.value.setHex(H.wallEm);
    // Горизонтальный перелив внутри стенки, осколка и мины-охотника: светло-голубой в тёплых тоннелях, светло-розовый — в остальных
    A.wallArcMat.uniforms.uShimmerColor.value.setHex(cold ? 0x8ee4ff : 0xffa6c9);
    A.wallRimMat.color.setHex(H.wallRim);
    A.wallRimSoftMat.color.setHex(H.wallRim);
    A.wallGlowMat.color.setHex(H.wallGlow);
    A.hunterCoreMat.color.setHex(H.huntBody);
    A.hunterCoreMat.emissive.setHex(H.huntEm);
    A.hunterCoreMat.emissiveIntensity = 0.92;
    A.hunterSpikeMat.color.setHex(H.huntBody);
    A.hunterSpikeMat.emissive.setHex(H.huntEm);
    A.hunterSpikeMat.emissiveIntensity = 0.85;
    A.hunterRingMat.color.setHex(H.wallRim);
    this.guideThreatMat?.color.setHex(H.shardEdge);
    A.hunterGlowMat.color.setHex(H.huntGlow);
    A.glintMat.color.setHex(H.huntLeg).lerp(this.tmpC.setHex(0xffffff), 0.52);
    A.rimMat.uniforms.uColor.value.setHex(H.wallRim).lerp(this.tmpC.setHex(0xffffff), 0.12);
    A.hunterTipMat.color.setHex(H.wallRim).lerp(this.tmpC.setHex(0xffffff), 0.28);
    A.hunterBeltMat.color.setHex(H.wallBody).lerp(this.tmpC.setHex(H.wallRim), 0.22);
    A.hunterBeltMat.emissive.setHex(H.wallRim);
    A.wallBandMat.color.setHex(H.wallBody).lerp(this.tmpC.setHex(H.wallRim), 0.22);
    A.wallBandMat.emissive.setHex(H.wallRim);
    A.haloMat.opacity = cold ? 0.46 : 0.38;
  }

  setBestTarget(n: number) {
    this.bestTarget = n;
  }

  setSkin(id: string) {
    const s = skinById(id);
    if (s.id !== this.skin.id) {
      this.player.remove(this.sparkRig.group);
      this.sparkRig.dispose();
      this.sparkRig = buildSparkRig(s);
      this.player.add(this.sparkRig.group);
    }
    this.skin = s;
    this.applySkin();
  }

  private setShield(on: boolean, duration = Infinity) {
    this.shield = on;
    this.shieldT = on ? duration : Infinity;
    this.shieldGroup.visible = on;
  }

  private applySkin() {
    const s = this.skin;
    const glowMat = this.playerGlow.material as THREE.SpriteMaterial;
    glowMat.map = this.sparkRig.coronaTex;
    glowMat.color.setHex(0xffffff);
    glowMat.needsUpdate = true;

    this.playerLight.color.setHex(s.light);
    (this.auraMesh.material as THREE.MeshBasicMaterial).color.setHex(s.mid);
    this.streakMat.color.setHex(s.trail);
    for (const t of this.trail) (t.material as THREE.SpriteMaterial).color.setHex(s.trail);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.clearInputState);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvasEl.removeEventListener('pointerdown', this.onPointerDown);
    this.skyDome.dispose();
    this.tunnelFx.dispose();
    disposeRibGeos(this.ribGeos);
    for (const m of Object.values(this.ribMats)) m.dispose();
    for (const tex of this.wallCache.values()) tex.dispose();
    this.wallCache.clear();
    for (const v of Object.values(this.assets)) {
      if (v && typeof (v as { dispose?: () => void }).dispose === 'function') {
        (v as { dispose: () => void }).dispose();
      }
    }
    this.glowTex.dispose();
    this.glintTex.dispose();
    this.darkTex.dispose();
    this.raysTex.dispose();
    this.ringTex.dispose();
    this.sparkRig.dispose();
    this.sound.dispose();
    this.renderer.dispose();
  }

  // ---------------- Внутреннее ----------------
  private reset() {
    this.clearInputState();
    for (const e of this.entities) {
      if (e.alive) this.recycleEntity(e);
    }
    this.entities.length = 0;
    for (const p of this.particles) p.sprite.visible = false;
    for (const b of this.themeBursts) {
      b.t = 1;
      b.group.visible = false;
    }
    this.playerAngle = -Math.PI / 2;
    this.targetAngle = -Math.PI / 2;
    this.player.position.set(0, -PLAYER_R, 0);
    this.speed = SPEED_START;
    this.light = MAX_LIGHT;
    this.score = 0;
    this.combo = 0;
    this.comboMax = 0;
    this.comboT = 0;
    this.orbs = 0;
    this.powerups = 0;
    this.nearMiss = 0;
    this.distance = 0;
    this.magnetT = 0;
    this.overchargeT = 0;
    this.shake = 0;
    this.flashFx = 0;
    this.beatBest = false;
    this.flowT = 0;
    this.flowStack = 0;
    this.flowStackT = 0;
    this.flowMax = 0;
    this.setShield(false);
    this.shieldBreakT = 0;
    this.magnetPop = 0;
    this.wardenBreakT = 0;
    this.wardenGroup.visible = false;
    this.tail.forEach((t) => (t.visible = false));
    this.spawnT = 0.25 + Math.random() * 0.28;
    this.firstSpawn = true;
    this.lastPattern = -1;
    this.roundSeedOffset = Math.random() * Math.PI * 2;
    this.time = 0;
    this.lastT = performance.now();
    this.hudT = 0;
    this.fog.density = this.fogBase;
    this.trailAng.fill(this.playerAngle);
    this.trailVis = 0;
    this.trail.forEach((t) => (t.visible = false));
  }

  private createEntityMesh(kind: Kind): {
    mesh: THREE.Object3D;
    radius: number;
    spinner?: THREE.Object3D;
    shadow?: THREE.Object3D;
    glints?: THREE.Sprite[];
  } {
    const A = this.assets;
    let radius = PLAYER_R;
    const g = new THREE.Group();

    if (kind === 'wall') {
      const outline = new THREE.Mesh(A.wallOutlineGeo, A.wallOutlineMat);
      const arc = new THREE.Mesh(A.wallArcGeo, A.wallArcMat);
      const crestAndEnds = new THREE.Mesh(A.wallRimMergedGeo, A.wallRimMat);
      const crestGlow = new THREE.Mesh(A.wallCrestGeo, A.wallRimSoftMat);
      const bandsMesh = new THREE.Mesh(A.wallBandsMergedGeo, A.wallBandMat);
      g.add(outline, arc, crestAndEnds, crestGlow, bandsMesh);
      this.world.add(g);
      return { mesh: g, radius: 0 };
    }

    // Тёмная подложка не вращается и лежит чуть дальше от камеры, чем сам объект
    const spinner = new THREE.Group();
    const hazard = kind === 'shard' || kind === 'hunter';
    const halo = new THREE.Sprite(hazard ? A.haloMat : A.haloSoftMat);
    halo.scale.setScalar(hazard ? 2.6 * OBST_SCALE : 1.9 * (kind === 'orb' ? 1 : BUFF_SCALE));
    halo.position.z = -0.7;
    g.add(halo, spinner);

    if (kind === 'orb') {
      // Классический огонёк-светлячок: чистое яркое ядро + тёплый золотой ореол
      spinner.add(new THREE.Mesh(A.orbCoreGeo, A.orbCoreMat));
      const orbHalo = new THREE.Sprite(A.orbGlowMat);
      orbHalo.scale.setScalar(1.85);
      spinner.add(orbHalo);
    } else if (kind === 'shard' || kind === 'hunter') {
      // Тёмный осколок и Мина-охотник в едином стиле со стенками:
      // та же форма (ядро, 6 шипов по осям и орбитальное кольцо), но с материалом внутреннего перелива стенки (wallArcMat),
      // тёмным контуром (wallOutlineMat), рельефными поясами (wallBandMat) и двойной неоновой кромкой (wallRimMat + wallRimSoftMat)
      const outline = new THREE.Mesh(A.hunterOutlineGeo, A.wallOutlineMat);
      const core = new THREE.Mesh(A.hunterCoreGeo, A.wallArcMat);
      const spikes = new THREE.Mesh(A.hunterSpikeGeo, A.wallArcMat);
      const belts = new THREE.Mesh(A.hunterBeltGeo, A.wallBandMat);
      const tips = new THREE.Mesh(A.hunterTipGeo, A.hunterTipMat);
      const tipsGlow = new THREE.Mesh(A.hunterTipSoftGeo, A.wallRimSoftMat);
      const ringA = new THREE.Mesh(A.hunterRingGeo, A.wallRimMat);
      const ringSoft = new THREE.Mesh(A.hunterRingSoftGeo, A.wallRimSoftMat);
      ringA.rotation.set(Math.PI / 5, Math.PI / 6, 0);
      ringSoft.rotation.set(Math.PI / 5, Math.PI / 6, 0);
      spinner.add(outline, core, spikes, belts, tips, tipsGlow, ringA, ringSoft);
      spinner.scale.setScalar(OBST_SCALE);
      radius = PLAYER_R + 0.05;
    } else if (kind === 'flash') {
      // Молния в кольце: считывается как «взрыв/энергия»
      const bolt = new THREE.Mesh(A.boltGeo, A.boltMat);
      const edges = new THREE.LineSegments(A.boltEdgesGeo, A.boltEdgeMat);
      const ring = new THREE.Mesh(A.flashRingGeo, A.flashRingMat);
      const glow = new THREE.Sprite(A.flashGlowMat);
      glow.scale.setScalar(2.7);
      spinner.add(ring, glow, bolt, edges);
      spinner.scale.setScalar(BUFF_SCALE);
    } else if (kind === 'magnet') {
      const u = new THREE.Mesh(A.magnetUGeo, A.magnetUMat);
      u.rotation.z = Math.PI;
      const tipL = new THREE.Mesh(A.magnetTipGeo, A.magnetTipMat);
      tipL.position.set(-0.4, 0.06, 0);
      const tipR = new THREE.Mesh(A.magnetTipGeo, A.magnetTipMat);
      tipR.position.set(0.4, 0.06, 0);
      const glow = new THREE.Sprite(A.magnetGlowMat);
      glow.scale.setScalar(2.8);
      spinner.add(u, tipL, tipR, glow);
      spinner.scale.setScalar(BUFF_SCALE);
    } else if (kind === 'shield') {
      // Щит: синий геральдический щит со звездой, светлым кантом и орбитальным кольцом
      const body = new THREE.Mesh(A.shieldBodyGeo, A.shieldBodyMat);
      const edges = new THREE.LineSegments(A.shieldEdgesGeo, A.shieldEdgeMat);
      const plate = new THREE.Mesh(A.shieldPlateGeo, A.shieldPlateMat);
      const emblem = new THREE.Mesh(A.shieldEmblemGeo, A.shieldEmblemMat);
      const plateBack = plate.clone();
      plateBack.rotation.y = Math.PI;
      const emblemBack = emblem.clone();
      emblemBack.rotation.y = Math.PI;
      const ring = new THREE.Mesh(A.shieldRingGeo, A.shieldRingMat);
      ring.rotation.x = Math.PI / 2.6;
      const glow = new THREE.Sprite(A.shieldGlowMat);
      glow.scale.setScalar(2.7);
      spinner.add(glow, body, edges, plate, plateBack, emblem, emblemBack, ring);
      spinner.scale.setScalar(BUFF_SCALE * 0.95);
    } else {
      // Перезарядка: батарея с тремя зелёными секциями заряда и контактом
      const body = new THREE.Mesh(A.battBodyGeo, A.battBodyMat);
      const edges = new THREE.LineSegments(A.battEdgesGeo, A.battEdgeMat);
      const tip = new THREE.Mesh(A.battTipGeo, A.battTipMat);
      tip.position.x = 0.55;
      const bars = [-0.29, 0, 0.29].map((x) => {
        const b = new THREE.Mesh(A.battBarGeo, A.battBarMat);
        b.position.set(x, 0, 0.16);
        return b;
      });
      const glow = new THREE.Sprite(A.overGlowMat);
      glow.scale.setScalar(2.6);
      spinner.add(glow, body, edges, tip, ...bars);
      spinner.scale.setScalar(BUFF_SCALE);
    }

    // Мягкая тень на обшивке: лежит на стене тоннеля за объектом и поворачивается вместе с его углом
    let shadow: THREE.Object3D | undefined;
    if (hazard) {
      shadow = new THREE.Group();
      const plane = new THREE.Mesh(A.shadowGeo, A.shadowMat);
      plane.position.x = TUNNEL_R + 0.1 - PLAYER_R;
      plane.rotation.y = -Math.PI / 2;
      plane.renderOrder = -0.5;
      shadow.add(plane);
      g.add(shadow);
    }

    this.world.add(g);
    return { mesh: g, radius, spinner, shadow };
  }

  /** 0..1 — насколько мы приблизились к максимальной скорости (0 — старт, 1 — потолок). */
  private speedK() {
    return Math.min(1, Math.max(0, (this.speed - SPEED_START) / (SPEED_END - SPEED_START)));
  }

  private makeEntity(kind: Kind, angle: number, z: number, dir = 1): Entity {
    // На высокой скорости ряды волны растягиваются по глубине: между преградами больше места для манёвра
    if (z <= SPAWN_Z) {
      const sk = this.speedK();
      const stretch = 1 + 0.24 * sk * sk * (3 - 2 * sk);
      z = SPAWN_Z + (z - SPAWN_Z) * stretch;
      if (z < this.patternMinZ) this.patternMinZ = z;
    }
    let bucket = this.entityPool.get(kind);
    if (!bucket) {
      bucket = [];
      this.entityPool.set(kind, bucket);
    }

    let e = bucket.pop();
    if (e) {
      e.angle = angle;
      e.z = z;
      e.alive = true;
      e.spin = Math.random() * 6.28;
      e.missed = false;
      e.dir = dir;
      e.mesh.visible = true;
      if (kind === 'orb') e.mesh.scale.setScalar(1);
    } else {
      const { mesh, radius, spinner, shadow, glints } = this.createEntityMesh(kind);
      e = { mesh, kind, angle, z, alive: true, spin: Math.random() * 6.28, radius, missed: false, dir, spinner, shadow, glints };
    }

    this.placeEntity(e);
    this.entities.push(e);
    return e;
  }

  private glowSprite(color: number, scale: number, opacity = 1) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    s.scale.setScalar(scale);
    return s;
  }

  private effAngleOf(e: Entity): number {
    return e.kind === 'wall' ? e.angle + e.spin * WALL_SPIN : e.angle;
  }

  private placeEntity(e: Entity, angle?: number) {
    if (e.kind === 'wall') {
      e.mesh.position.set(0, 0, e.z);
      return;
    }
    const a = angle ?? e.angle;
    e.mesh.position.set(Math.cos(a) * e.radius, Math.sin(a) * e.radius, e.z);
    if (e.shadow) e.shadow.rotation.z = a;
  }

  private recycleEntity(e: Entity) {
    e.alive = false;
    e.mesh.visible = false;
    let bucket = this.entityPool.get(e.kind);
    if (!bucket) {
      bucket = [];
      this.entityPool.set(e.kind, bucket);
    }
    bucket.push(e);
  }

  private kill(e: Entity) {
    if (!e.alive) return;
    this.recycleEntity(e);
  }

  private difficulty() {
    return Math.min(1, this.distance / 2100);
  }

  private rollBuffKind(): Kind {
    const b = Math.random();
    if (b < 0.3) return 'magnet';
    if (b < 0.58) return 'flash';
    if (b < 0.8) return 'overcharge';
    return 'shield';
  }

  /**
   * Множитель частоты появления баффов по очкам (+7% больше спавнов баффов во время забега):
   * — до 15 000 очков: 0.8 × 1.07,
   * — от 15 000 до 30 000 очков: 0.9 × 1.07,
   * — с 30 000 очков: 1.0 × 1.07.
   */
  private buffRateMultiplier(): number {
    const base = this.score < 15000 ? 0.8 : this.score < 30000 ? 0.9 : 1.0;
    return base * 1.07;
  }

  /** С учётом множителя очков добавляет бафф в волну препятствий. */
  private maybeSpawnBonusBuff(angle: number, z: number, chance = 0.24) {
    if (Math.random() < chance * 0.94 * this.buffRateMultiplier()) {
      this.makeEntity(this.rollBuffKind(), angle, z);
    }
  }

  /** Создаёт уникальную стартовую раскладку препятствий при каждом новом запуске раунда. */
  private spawnInitialRoundLayout() {
    const startVariant = Math.floor(Math.random() * 5);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const baseZ = -40 - Math.random() * 12;
    const baseAng = this.playerAngle + (Math.random() - 0.5) * 0.9 + this.roundSeedOffset * 0.15;

    if (startVariant === 0) {
      // Диагональный слалом из мин и дуги светлячков
      for (let i = 0; i < 5; i++) {
        const a = baseAng + dir * i * 0.34;
        this.makeEntity('orb', a, baseZ - i * 3.6);
        if (i !== 2) this.makeEntity('shard', a - dir * (0.62 + (i % 2) * 0.25), baseZ - 4 - i * 5.2);
      }
      this.makeEntity('hunter', baseAng + Math.PI * 0.4 * dir, baseZ - 32);
    } else if (startVariant === 1) {
      // Разомкнутое кольцо со смещённым коридором
      const count = 7;
      const step = (Math.PI * 2) / count;
      const gap = Math.floor(Math.random() * count);
      for (let i = 0; i < count; i++) {
        if (i === gap || i === (gap + 1) % count) continue;
        this.makeEntity('shard', baseAng + i * step, baseZ - 14);
      }
      const passAng = baseAng + (gap + 0.5) * step;
      for (let i = 0; i < 5; i++) {
        this.makeEntity('orb', passAng + (i - 2) * 0.14 * dir, baseZ - 4 - i * 3.4);
      }
    } else if (startVariant === 2) {
      // Шахматный каскад мин-охотников и боковая цепочка светлячков
      for (let i = 0; i < 5; i++) {
        const z = baseZ - i * 5.8;
        const a = this.playerAngle + ((i % 2 === 0 ? 1 : -1) * (0.45 + Math.random() * 0.65));
        this.makeEntity(i === 4 ? 'hunter' : 'shard', a, z);
        if (i < 5) this.makeEntity('orb', a + dir * 0.58, z - 2.2);
      }
    } else if (startVariant === 3) {
      // Двойная встречная спираль со свободным рукавом
      for (let i = 0; i < 6; i++) {
        const z = baseZ - 6 - i * 4.6;
        const a = baseAng + dir * i * 0.42;
        if (i !== 3) this.makeEntity('shard', a + 0.75, z);
        if (i % 4 === 0) this.makeEntity('shard', a - 0.85, z - 2.1);
        this.makeEntity('orb', a, z - 1.0);
      }
    } else {
      // Разбросанное минное поле с охотником на фланге
      for (let i = 0; i < 6; i++) {
        const z = baseZ - 5 - i * 5.4;
        const randA = this.playerAngle + (Math.random() - 0.5) * Math.PI * 1.6;
        if (i !== 4) this.makeEntity(i === 2 ? 'hunter' : 'shard', randA, z);
        this.makeEntity('orb', randA + (Math.random() < 0.5 ? 0.55 : -0.55), z - 2.4);
      }
    }

    // Дополнительно закладываем вторую волну в глубине тоннеля со случайным сдвигом
    const secondA = Math.random() * Math.PI * 2;
    this.spawnPatternInner(0.08, -108 - Math.random() * 18, secondA, 0, false);
    this.spawnT = 0.85 + Math.random() * 0.35;
  }

  private spawnPattern() {
    const d = this.difficulty();
    const base = SPAWN_Z - Math.random() * 8;
    const a0 = Math.random() * Math.PI * 2;
    const dark = Math.max(0, (this.score - 9000) / 14000);
    const gatesAllowed = this.distance > 160;

    if (this.firstSpawn) {
      this.firstSpawn = false;
      this.spawnInitialRoundLayout();
      return;
    }

    this.patternMinZ = base;
    this.spawnPatternInner(d, base, a0, dark, gatesAllowed);
    // Паузы между волнами чуть длиннее — на ~10% легче + небольшая вариативность
    this.spawnT *= 1.06 + Math.random() * 0.08;
    // Просвет между волнами считаем в метрах, а не только в секундах: чем ближе к максимальной
    // скорости, тем больше свободного пространства между концом одной волны и началом следующей.
    const sk = this.speedK();
    // На скорости метровый промежуток между волнами растёт сам (время × скорость) — слегка сжимаем его
    this.spawnT *= 1 - 0.16 * sk;
    const clearM = Math.max(0, sk - 0.2) / 0.8 * 24;
    if (clearM > 0) {
      const waveLen = base - this.patternMinZ;
      this.spawnT = Math.max(this.spawnT, (waveLen + clearM) / Math.max(20, this.speed));
    }
  }

  private spawnPatternInner(d: number, base: number, a0: number, dark: number, gatesAllowed: boolean) {
    const buffMult = this.buffRateMultiplier();
    const buffWaveChance = 0.075 * buffMult;
    const r = Math.random();

    if (r > 1 - buffWaveChance) {
      // Выделенная волна баффа под охраной мин (частота зависит от множителя баффов по очкам)
      const buffKind = this.rollBuffKind();
      const spread = 0.52 + Math.random() * 0.18;
      this.makeEntity(buffKind, a0, base - 4);
      this.makeEntity('shard', a0 + spread, base);
      this.makeEntity('shard', a0 - spread, base);
      if (d > 0.35 || Math.random() < 0.4) this.makeEntity('hunter', a0 + Math.PI * (0.7 + Math.random() * 0.6), base - 9);
      for (let i = 0; i < 3; i++) this.makeEntity('orb', a0 + (i - 1) * 0.12, base - 9 - i * 3.0);
      this.spawnT = 1.1 + Math.random() * 0.15;
      return;
    }

    // Выбираем тип волны так, чтобы одинаковые паттерны не шли подряд и каждый раз меняли геометрию
    const pool = [0, 1, 2, 3, 5];
    if (gatesAllowed) pool.push(4);
    const candidates = pool.filter((p) => p !== this.lastPattern);
    const pat = candidates[Math.floor(Math.random() * candidates.length)];
    this.lastPattern = pat;

    if (pat === 0) {
      // Извилистая дорожка светлячков под охраной боковых мин
      const n = 5 + Math.floor(Math.random() * 5);
      const twist = (Math.random() < 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.14 + d * 0.12);
      const stepZ = 3.0 + Math.random() * 0.7;
      for (let i = 0; i < n; i++) {
        const ang = a0 + twist * i;
        this.makeEntity('orb', ang, base - i * stepZ);
        if (i % 2 === 1 && Math.random() < 0.7) {
          const side = (i % 4 === 1 ? 1 : -1) * (0.54 + Math.random() * 0.16);
          this.makeEntity(Math.random() < 0.2 ? 'hunter' : 'shard', ang + side, base - i * stepZ);
        }
      }
      this.maybeSpawnBonusBuff(a0 + twist * n, base - n * stepZ - 3, 0.28);
      this.spawnT = (1.1 + n * 0.1) * (dark > 0 ? 0.82 : 1);
    } else if (pat === 1) {
      // Кольцо препятствий с узким проходом (и вторым каскадным кольцом)
      const n = Math.min(d > 0.55 ? 11 : 9, 6 + Math.floor(d * 4 + Math.random() * 2));
      const step = (Math.PI * 2) / (n + 2);
      const gap = Math.floor(Math.random() * (n + 2));
      for (let i = 0; i < n + 2; i++) {
        if (i === gap || i === (gap + 1) % (n + 2)) continue;
        if (Math.random() < 0.1) continue; // −10% мин в кольце
        this.makeEntity('shard', a0 + i * step + (Math.random() - 0.5) * 0.08, base - (i % 2) * 1.4);
      }
      const gapCenter = a0 + gap * step + step * 0.5;
      this.makeEntity('orb', gapCenter, base - 3.5);
      this.maybeSpawnBonusBuff(gapCenter + step, base - 7, 0.25);

      if ((d > 0.28 && Math.random() < 0.42) || Math.random() < 0.15) {
        const gap2 = (gap + 2 + Math.floor(Math.random() * Math.max(2, n - 1))) % (n + 2);
        const z2 = base - (13 + Math.random() * 5);
        for (let i = 0; i < n + 2; i++) {
          if (i === gap2 || i === (gap2 + 1) % (n + 2)) continue;
          if (Math.random() < 0.1) continue;
          this.makeEntity('shard', a0 + i * step, z2);
        }
        this.makeEntity('orb', a0 + gap2 * step + step * 0.5, z2 - 3.5);
        this.spawnT = Math.max(0.95, 1.38 - d * 0.32);
      } else {
        this.spawnT = Math.max(0.72, 1.12 - d * 0.38);
      }
    } else if (pat === 2) {
      // Минное поле: эшелон мин со случайным шагом и охотниками
      const n = 5 + Math.floor(d * 3 + Math.random() * 2);
      const zGap = 6.6 + Math.random() * 2.4;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const z = base - i * zGap;
        this.makeEntity(Math.random() < 0.18 ? 'hunter' : 'shard', a, z);
        if (Math.random() < 0.2 + d * 0.2) {
          this.makeEntity('shard', a + Math.PI * (0.45 + Math.random() * 0.65), z - (Math.random() - 0.5) * 2.2);
        }
        if (Math.random() < 0.65) {
          this.makeEntity('orb', a + (Math.random() < 0.5 ? 0.54 : -0.54), z - 2.6);
        }
      }
      this.maybeSpawnBonusBuff(a0 + Math.PI * 0.5, base - n * (zGap * 0.5), 0.26);
      this.spawnT = Math.max(1.05, 1.38 - d * 0.24);
    } else if (pat === 3) {
      // Двойная спираль мин с коридором светлячков
      const n = 6 + Math.floor(d * 3 + Math.random() * 2);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const stepA = 0.28 + Math.random() * 0.16;
      const stepZ = 4.1 + Math.random() * 1.1;
      for (let i = 0; i < n; i++) {
        const z = base - i * stepZ;
        const ang = a0 + dir * i * stepA;
        this.makeEntity('shard', ang, z);
        if (i % 4 === 0 || (d > 0.45 && i % 2 === 0)) {
          this.makeEntity('shard', ang + Math.PI * (0.85 + Math.random() * 0.3), z);
        }
        this.makeEntity('orb', ang + dir * Math.PI * 0.5, z);
      }
      this.maybeSpawnBonusBuff(a0 + dir * n * stepA + dir * Math.PI * 0.5, base - n * stepZ - 3, 0.25);
      this.spawnT = Math.max(1.05, 1.32 - d * 0.2);
    } else if (pat === 4) {
      // Вращающиеся лазерные стенки-шлюзы
      const dir = Math.random() < 0.5 ? 1 : -1;
      const offset2 = Math.PI * (0.65 + Math.random() * 0.7);
      this.makeEntity('wall', a0, base, dir);
      // расстояние между стенками в полтора раза больше прежнего (15–19 м → 22–28 м, 32 м → 48 м)
      this.makeEntity('wall', a0 + offset2, base - (22.5 + Math.random() * 6), -dir);
      const hasThird = d > 0.62 && Math.random() < 0.5;
      if (hasThird) {
        this.makeEntity('wall', a0 + Math.PI * (0.2 + Math.random() * 0.5), base - 48, dir);
      }
      for (let i = 0; i < 3; i++) this.makeEntity('orb', a0 + Math.PI + (i - 1) * 0.34, base - 5 - i * 2.6);
      this.maybeSpawnBonusBuff(a0 + Math.PI, base - 34, 0.32);
      this.spawnT = Math.max(3.0, 3.5 - d * 0.45) + (hasThird ? 0.6 : 0);
    } else {
      // Охотничья стая самонаводящихся мин-охотников + мины прикрытия
      const nd = 2 + Math.floor(d * 2.5 + Math.random() * 1.5);
      const stepAng = 0.95 + Math.random() * 0.65;
      for (let i = 0; i < nd; i++) {
        const da = a0 + i * stepAng * (i % 2 === 0 ? 1 : -1);
        this.makeEntity('hunter', da, base - i * (9.5 + Math.random() * 2.5));
        if (i % 2 === 1 && Math.random() < 0.7) this.makeEntity('shard', da + Math.PI * (0.55 + Math.random() * 0.3), base - i * 10.0 - 4);
      }
      for (let i = 0; i < 4; i++) this.makeEntity('orb', a0 + Math.PI + i * 0.26, base - 3 - i * 3.0);
      this.maybeSpawnBonusBuff(a0 + Math.PI + 0.5, base - nd * 10.5 - 2, 0.28);
      this.spawnT = Math.max(1.4, 1.85 - d * 0.28);
    }
  }

  private emit(pos: THREE.Vector3, color: number, count: number, power = 1) {
    let n = 0;
    for (const p of this.particles) {
      if (n >= count) break;
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      p.sprite.position.copy(pos);
      const m = p.sprite.material as THREE.SpriteMaterial;
      m.color.setHex(color);
      m.opacity = 1;
      p.vel.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 4 + Math.random() * 9).multiplyScalar(power);
      p.maxLife = p.life = 0.4 + Math.random() * 0.45;
      p.sprite.scale.setScalar(0.3 + Math.random() * 0.55);
      n++;
    }
  }

  /**
   * Всплывающая плашка («КОМБО», «УДАР», «ВПРИТИРКУ»…). Рисуется не в 3D-сцене, а HTML-слоем
   * в нижней полосе экрана (см. Popups в Screens.tsx) — поэтому никогда не лезет в центр и не мешает игре.
   */
  private showPopup(text: string, color: number, _at: THREE.Vector3, big = false) {
    this.callbacks.onPopup?.(text, '#' + color.toString(16).padStart(6, '0'), big);
  }

  private setShieldOpacity(k: number) {
    for (const m of this.shieldMats) (m.mat as THREE.MeshBasicMaterial).opacity = m.base * k;
  }

  private spawnEmber() {
    const pPos = this.player.position;
    const star = this.skin.shape === 'star';
    for (const p of this.particles) {
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      const m = p.sprite.material as THREE.SpriteMaterial;
      if (star) {
        // «Звёздная пыль»: мелкие разноцветные искры по спирали вокруг ядра
        const a = Math.random() * Math.PI * 2;
        const r = 0.28 + Math.random() * 0.2;
        p.sprite.position.set(pPos.x + Math.cos(a) * r, pPos.y + Math.sin(a) * r, pPos.z + 0.2);
        m.color.setHex(STAR_DUST[Math.floor(Math.random() * STAR_DUST.length)]);
        m.opacity = 0.95;
        const tang = 1.4 + Math.random() * 1.2;
        p.vel.set(-Math.sin(a) * tang + Math.cos(a) * 0.9, Math.cos(a) * tang + Math.sin(a) * 0.9, 4.5 + Math.random() * 3);
        p.maxLife = p.life = 0.45 + Math.random() * 0.3;
        p.sprite.scale.setScalar(0.1 + Math.random() * 0.14);
        return;
      }
      p.sprite.position.set(pPos.x + (Math.random() - 0.5) * 0.28, pPos.y + (Math.random() - 0.5) * 0.28, pPos.z + 0.2);
      m.color.setHex(this.skin.trail);
      m.opacity = 0.85;
      p.vel.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 5 + Math.random() * 3);
      p.maxLife = p.life = 0.34 + Math.random() * 0.22;
      p.sprite.scale.setScalar(0.2 + Math.random() * 0.18);
      return;
    }
  }

  /** Кольцо искр в момент ударной волны «Нулевой точки». */
  private spawnZeroRipple(pos: THREE.Vector3) {
    const r = this.zeroRipples.find((x) => x.t >= 1) ?? this.zeroRipples[0];
    r.t = 0;
    r.mesh.position.set(pos.x, pos.y, pos.z + 0.3);
    r.mesh.visible = true;
  }

  /**
   * Красочные компактные (в ~2 раза меньше прежних) анимации взаимодействия со светлячками
   * и препятствиями для премиальных тоннелей (lemon, zero, magma, crystal, prism).
   */
  private spawnThemeInteraction(pos: THREE.Vector3, isObstacle: boolean) {
    const id = this.theme.id;
    const isPremium = id === 'lemon' || id === 'zero' || id === 'magma' || id === 'crystal' || id === 'prism';
    if (!isPremium) return;

    const b = this.themeBursts.find((x) => x.t >= 1) ?? this.themeBursts[0];
    b.t = 0;
    b.style = id;
    b.kind = isObstacle ? 'obstacle' : 'orb';
    b.dur = isObstacle ? 0.52 : 0.44;
    b.group.position.set(pos.x, pos.y, pos.z + 0.22);
    b.group.rotation.set(0, 0, Math.random() * Math.PI);
    b.ringB.rotation.z = Math.random() * Math.PI;
    b.ringC.rotation.z = Math.random() * Math.PI;
    b.group.visible = true;

    const spawnRadialParticles = (pal: number[], count: number, r0: number, radSpeed: number, tangSpeed: number, life: number, scale: number) => {
      let k = 0;
      for (const p of this.particles) {
        if (k >= count) break;
        if (p.sprite.visible) continue;
        p.sprite.visible = true;
        const a = (k / count) * Math.PI * 2 + (k % 2) * 0.14;
        const m = p.sprite.material as THREE.SpriteMaterial;
        m.color.setHex(pal[k % pal.length]);
        m.opacity = 1;
        p.sprite.position.set(pos.x + Math.cos(a) * r0, pos.y + Math.sin(a) * r0, pos.z + 0.14);
        const sp = radSpeed * (0.86 + (k % 3) * 0.12);
        p.vel.set(Math.cos(a) * sp - Math.sin(a) * tangSpeed, Math.sin(a) * sp + Math.cos(a) * tangSpeed, 2.2);
        p.maxLife = p.life = life;
        p.sprite.scale.setScalar(scale * (k % 2 === 0 ? 1.08 : 0.85));
        k++;
      }
    };

    if (id === 'lemon') {
      // Солнечная корона: золотисто-лимонный, янтарно-коралловый и неоново-мятный перелив
      b.colA = isObstacle ? 0x22d3ee : 0xffe14d;
      b.colB = isObstacle ? 0xffe14d : 0xff922b;
      b.colC = isObstacle ? 0xf472b6 : 0x4ade80;
      b.matA.color.setHex(b.colA);
      b.matB.color.setHex(b.colB);
      b.matC.color.setHex(b.colC);
      const pal = isObstacle ? [0x22d3ee, 0xffe14d, 0xf472b6, 0x38bdf8] : [0xffe14d, 0xff922b, 0x4ade80, 0xff6b8b, 0xfff5b8];
      spawnRadialParticles(pal, isObstacle ? 12 : 10, 0.12, isObstacle ? 2.6 : 2.0, 0.6, 0.38, 0.16);
    } else if (id === 'zero') {
      // Сингулярная линза: серебристо-платиновый с хроматическим фиолетово-цианово-розовым ореолом
      b.colA = 0xf8fafc;
      b.colB = isObstacle ? 0x38bdf8 : 0xa78bfa;
      b.colC = isObstacle ? 0xf472b6 : 0x67e8f9;
      b.matA.color.setHex(b.colA);
      b.matB.color.setHex(b.colB);
      b.matC.color.setHex(b.colC);
      this.spawnZeroRipple(pos);
      const pal = isObstacle ? [0xf8fafc, 0x38bdf8, 0xa78bfa, 0xf472b6] : [0xf8fafc, 0x67e8f9, 0xc084fc, 0xf9a8d4];
      spawnRadialParticles(pal, isObstacle ? 12 : 10, 0.15, 1.9, 1.5, 0.4, 0.15);
    } else if (id === 'magma') {
      // Вулканический вихрь: огненно-алый, расплавленное золото, пурпурно-малиновый и бирюзовый жар
      b.colA = 0xff4d1f;
      b.colB = isObstacle ? 0x2ec4b6 : 0xffbe0b;
      b.colC = isObstacle ? 0xffbe0b : 0xff2a85;
      b.matA.color.setHex(b.colA);
      b.matB.color.setHex(b.colB);
      b.matC.color.setHex(b.colC);
      const pal = isObstacle ? [0x2ec4b6, 0xff5e1f, 0xffbe0b, 0x38bdf8] : [0xffbe0b, 0xff4d1f, 0xff2a85, 0xfb5607, 0xc77dff];
      spawnRadialParticles(pal, isObstacle ? 14 : 12, 0.13, isObstacle ? 2.5 : 2.1, 1.1, 0.42, 0.17);
    } else if (id === 'crystal') {
      // Кристальный разлом: алмазный белый, сапфировый циан, аметист и розовый кварц
      b.colA = 0x38bdf8;
      b.colB = 0xc084fc;
      b.colC = isObstacle ? 0xf472b6 : 0x2dd4bf;
      b.matA.color.setHex(b.colA);
      b.matB.color.setHex(b.colB);
      b.matC.color.setHex(b.colC);
      const pal = [0xffffff, 0x38bdf8, 0x2dd4bf, 0xc084fc, 0xf472b6];
      spawnRadialParticles(pal, 14, 0.11, isObstacle ? 2.7 : 2.15, 0.35, 0.4, 0.16);
    } else if (id === 'prism') {
      // Призматический сон: тройная радужная хроматическая волна и спектральная спираль
      b.colA = 0x00f5d4;
      b.colB = 0xff4d94;
      b.colC = 0xffbe0b;
      b.matA.color.setHex(b.colA);
      b.matB.color.setHex(b.colB);
      b.matC.color.setHex(b.colC);
      const pal = [0x00f5d4, 0x38bdf8, 0xa855f7, 0xff4d94, 0xffbe0b, 0x4ade80];
      spawnRadialParticles(pal, isObstacle ? 16 : 12, 0.13, isObstacle ? 2.55 : 2.05, 1.4, 0.44, 0.17);
    }
  }

  /**
   * Анимация взаимодействия с подобранным баффом (Вспышка, Магнит, Щит, Перезаряд),
   * окрашенная строго в фирменную палитру подобранного баффа и компактная по размеру.
   */
  private spawnBuffInteraction(pos: THREE.Vector3, buffKind: 'flash' | 'magnet' | 'shield' | 'overcharge') {
    const b = this.themeBursts.find((x) => x.t >= 1) ?? this.themeBursts[0];
    b.t = 0;
    b.style = `buff_${buffKind}`;
    b.kind = 'buff';
    b.dur = 0.48;
    b.group.position.set(pos.x, pos.y, pos.z + 0.22);
    b.group.rotation.set(0, 0, Math.random() * Math.PI);
    b.ringB.rotation.z = Math.random() * Math.PI;
    b.ringC.rotation.z = Math.random() * Math.PI;
    b.group.visible = true;

    let pal: number[];
    if (buffKind === 'flash') {
      b.colA = 0xffe14d;
      b.colB = 0xff9f1c;
      b.colC = 0xfff8d6;
      pal = [0xffe14d, 0xffb703, 0xfff3b0, 0xf59e0b];
    } else if (buffKind === 'magnet') {
      b.colA = 0xa855f7;
      b.colB = 0xe879f9;
      b.colC = 0xd8b4fe;
      pal = [0xc084fc, 0xe879f9, 0x8b5cf6, 0xf0abfc];
    } else if (buffKind === 'shield') {
      b.colA = 0x38bdf8;
      b.colB = 0x7dd3fc;
      b.colC = 0xe2e8f0;
      pal = [0x38bdf8, 0x7dd3fc, 0xe0f2fe, 0x60a5fa];
    } else {
      b.colA = 0x4ade80;
      b.colB = 0xa3e635;
      b.colC = 0x6ee7b7;
      pal = [0x4ade80, 0xa3e635, 0x34d399, 0xbef264];
    }

    b.matA.color.setHex(b.colA);
    b.matB.color.setHex(b.colB);
    b.matC.color.setHex(b.colC);

    const count = 12;
    let k = 0;
    for (const p of this.particles) {
      if (k >= count) break;
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      const a = (k / count) * Math.PI * 2;
      const m = p.sprite.material as THREE.SpriteMaterial;
      m.color.setHex(pal[k % pal.length]);
      m.opacity = 1;
      p.sprite.position.set(pos.x + Math.cos(a) * 0.14, pos.y + Math.sin(a) * 0.14, pos.z + 0.15);
      const sp = 2.25 + (k % 2) * 0.45;
      p.vel.set(Math.cos(a) * sp - Math.sin(a) * 0.9, Math.sin(a) * sp + Math.cos(a) * 0.9, 2.4);
      p.maxLife = p.life = 0.42;
      p.sprite.scale.setScalar(0.17);
      k++;
    }
  }

  /** Обновляет анимации взаимодействия премиальных тоннелей, баффов и локальную рябь (в ~2 раза компактнее). */
  private updateZeroFx(dt: number) {
    for (const w of this.zeroWaves) {
      w.visible = false;
    }
    for (const r of this.zeroRipples) {
      if (r.t >= 1) {
        r.mesh.visible = false;
        continue;
      }
      r.t = Math.min(1, r.t + dt * 1.85);
      r.mesh.scale.setScalar(0.24 + r.t * 1.05);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - r.t, 2) * 0.78;
    }
    for (const b of this.themeBursts) {
      if (b.t >= 1) {
        b.group.visible = false;
        continue;
      }
      b.t = Math.min(1, b.t + dt / b.dur);
      const p = b.t;
      const ease = 1 - Math.pow(1 - p, 3);
      const fade = Math.pow(1 - p, 1.75);
      // Размер уменьшен примерно в 2 раза (0.95..1.25 вместо 1.95..2.6), чтобы не закрывать обзор
      const maxScale = b.kind === 'obstacle' ? 1.25 : b.kind === 'buff' ? 1.12 : 0.96;
      b.ringA.scale.setScalar(0.18 + ease * maxScale);
      b.ringB.scale.setScalar(0.14 + p * maxScale * 1.15);
      b.ringC.scale.setScalar(0.1 + ease * maxScale * 0.74);
      b.ringB.rotation.z += dt * (b.style === 'crystal' ? 3.2 : 2.1);
      b.ringC.rotation.z -= dt * 2.6;
      b.matA.opacity = fade * 0.92;
      b.matB.opacity = fade * 0.8;
      b.matC.opacity = fade * 0.85;
      if (b.style === 'prism') {
        b.matA.color.setHSL((0.48 + p * 0.45) % 1, 0.95, 0.65);
        b.matB.color.setHSL((0.82 - p * 0.4 + 1) % 1, 0.95, 0.66);
        b.matC.color.setHSL((0.14 + p * 0.5) % 1, 0.95, 0.66);
      } else {
        // Плавный красочный перелив между кольцами во время раскрытия
        this.tmpC.setHex(b.colA).lerp(this.tmpC2.setHex(b.colB), p * 0.45);
        b.matA.color.copy(this.tmpC);
        this.tmpC.setHex(b.colB).lerp(this.tmpC2.setHex(b.colC), p * 0.55);
        b.matB.color.copy(this.tmpC);
      }
    }
  }

  private spawnNovaBurst() {
    const pPos = this.player.position;
    const n = 14;
    let k = 0;
    for (const p of this.particles) {
      if (k >= n) break;
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.2;
      const m = p.sprite.material as THREE.SpriteMaterial;
      m.color.setHex(STAR_DUST[k % STAR_DUST.length]);
      m.opacity = 1;
      p.sprite.position.set(pPos.x + Math.cos(a) * 0.4, pPos.y + Math.sin(a) * 0.4, pPos.z + 0.1);
      p.vel.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 2.2);
      p.maxLife = p.life = 0.55 + Math.random() * 0.2;
      p.sprite.scale.setScalar(0.16 + Math.random() * 0.1);
      k++;
    }
  }

  private spawnAttractionParticle() {
    const pPos = this.player.position;
    for (const p of this.particles) {
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      const a = Math.random() * Math.PI * 2;
      const r = 2.1 + Math.random() * 0.8;
      p.sprite.position.set(pPos.x + Math.cos(a) * r, pPos.y + Math.sin(a) * r, pPos.z - 0.5);
      const m = p.sprite.material as THREE.SpriteMaterial;
      m.color.setHex(0xc3aaff);
      m.opacity = 0.9;
      p.vel.copy(pPos).sub(p.sprite.position).multiplyScalar(3.2);
      p.vel.z += 2;
      p.maxLife = p.life = 0.42;
      p.sprite.scale.setScalar(0.34);
      return;
    }
  }

  private gameOver() {
    this.clearInputState();
    this.over = true;
    this.running = false;
    this.needsStaticRender = true;
    this.fog.density = 0.024 * FOG_K;
    this.ambient.intensity = 0.6 * this.ambK;
    this.playerLight.intensity = 24 * this.lightK;
    this.sound.stopDrone();
    this.sound.gameOver();
    this.pushHud();
    this.callbacks.onGameOver({
      score: Math.floor(this.score),
      orbs: this.orbs,
      distance: Math.floor(this.distance),
      powerups: this.powerups,
      nearMiss: this.nearMiss,
      comboMax: this.comboMax,
      flowMax: this.flowMax,
    });
  }

  private buildRadarDots(): RadarDot[] {
    const out = this.radarOut;
    const pool = this.radarPool;
    let count = 0;
    const W = RADAR_WIN;
    for (let i = 0; i < this.entities.length && count < pool.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      const dist = -e.z;
      if (dist < 1 || dist > RADAR_RANGE) continue;
      const linDist = dist / RADAR_RANGE;
      const y = Math.sqrt(linDist);
      const rel = wrapAngle(this.effAngleOf(e) - this.playerAngle);
      const dot = pool[count];
      if (e.kind === 'wall') {
        const h = WALL_ARC / 2;
        dot.x = 0.5 + Math.max(-1, Math.min(1, rel / W)) * 0.5;
        dot.y = y;
        dot.k = 3;
        dot.w = h / (2 * W);
        dot.e = false;
        dot.ang = rel;
        dot.dist = linDist;
        dot.arc = h;
        out[count++] = dot;
        continue;
      }
      const isBuff = e.kind === 'flash' || e.kind === 'magnet' || e.kind === 'overcharge' || e.kind === 'shield';
      const threat = e.kind === 'shard' || e.kind === 'hunter';
      const outOfFront = Math.abs(rel) > W;
      dot.x = outOfFront ? (rel < 0 ? 0.02 : 0.98) : 0.5 + (rel / W) * 0.5;
      dot.y = y;
      dot.k = e.kind === 'orb' ? 1 : isBuff ? 2 : e.kind === 'hunter' ? 4 : 0;
      dot.w = 0;
      dot.e = outOfFront && threat && dist < 85;
      dot.ang = rel;
      dot.dist = linDist;
      dot.arc = 0;
      out[count++] = dot;
    }
    out.length = count;
    return out;
  }

  private updateLiveSonar() {
    liveSonarFrame.dots = this.buildRadarDots();
    liveSonarFrame.scrollZ = this.scrollZ;
    liveSonarFrame.playerAngle = this.playerAngle;
    liveSonarFrame.speed = this.speed;
    liveSonarFrame.danger = 1 - Math.max(0, this.light) / MAX_LIGHT;
  }

  private pushHud(sonarAlreadyUpdated = false) {
    if (!sonarAlreadyUpdated) this.updateLiveSonar();
    this.callbacks.onHud({
      score: Math.floor(this.score),
      light: Math.max(0, this.light),
      speed: this.speed,
      combo: this.combo,
      comboT: Math.max(0, Math.min(1, this.comboT / COMBO_HOLD)),
      orbs: this.orbs,
      distance: Math.floor(this.distance),
      magnet: this.magnetT,
      overcharge: this.overchargeT,
      shield: this.shield,
      shieldLeft: this.shield && Number.isFinite(this.shieldT) ? Math.max(0, this.shieldT) : 0,
      warden: this.wardenCharges > 0,
      danger: 1 - Math.max(0, this.light) / MAX_LIGHT,
      flow: Math.max(0, Math.min(1, this.flowT / FLOW_TIME)),
      powerups: this.powerups,
      nearMiss: this.nearMiss,
      radar: Engine.EMPTY_RADAR,
    });
  }

  private update(dt: number) {
    this.time += dt;

    // Автоматический контроль плавности: если после разгона (>1.2 с) средний FPS устойчиво ниже ~45, мягко снижаем pixelRatio
    if (this.time > 1.2) {
      this.fpsAccum += dt;
      this.fpsFrames++;
      if (this.fpsFrames >= 55) {
        const avgDt = this.fpsAccum / this.fpsFrames;
        const floor = Math.min(this.maxDpr, 1.0);
        if (avgDt > 0.022 && this.curDpr > floor + 0.01) {
          this.curDpr = Math.max(floor, +(this.curDpr - 0.15).toFixed(2));
          this.renderer.setPixelRatio(this.curDpr);
          this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        }
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }
    }

    // --- Управление: мир вращается вокруг игрока (клавиатура A/D или мобильные боковые поля со стрелочками) ---
    const steerDir = this.touchDir !== 0 ? this.touchDir : this.keyDir;
    this.steerVel += (steerDir - this.steerVel) * (1 - Math.exp(-32 * dt));
    if (Math.abs(this.steerVel) > 0.001) {
      this.targetAngle += this.steerVel * (3.85 * 1.2) * dt;
    }
    const diff = wrapAngle(this.targetAngle - this.playerAngle);
    const lerp = 1 - Math.exp(-20 * dt);
    const prevAngle = this.playerAngle;
    this.playerAngle += diff * lerp;
    const dAngle = wrapAngle(this.playerAngle - prevAngle);
    this.targetAngle = this.playerAngle + diff * (1 - lerp);
    this.world.rotation.z = -Math.PI / 2 - this.playerAngle;
    this.player.rotation.z = -diff * 0.35;

    // --- Движение ---
    const d = this.difficulty();
    this.speed = (SPEED_START + d * (SPEED_END - SPEED_START)) * (this.overchargeT > 0 ? 1.14 : 1);
    const move = this.speed * dt;
    this.distance += move;
    const scoreMul = this.fx.scoreMult * (this.flowT > 0 ? 1.5 : 1);
    this.score += move * 0.55 * scoreMul;

    if (this.flowT > 0) this.flowT = Math.max(0, this.flowT - dt);
    if (this.flowStackT > 0) {
      this.flowStackT = Math.max(0, this.flowStackT - dt);
      if (this.flowStackT === 0) this.flowStack = 0;
    }

    if (!this.beatBest && this.bestTarget > 0 && this.score > this.bestTarget) {
      this.beatBest = true;
      this.flashFx = 0.8;
      this.shake = 0.5;
      this.tmpV.copy(this.player.position);
      this.emit(this.tmpV, 0xffd166, 24, 1.8);
      this.showPopup('НОВЫЙ РЕКОРД', 0xffd166, this.tmpV, true);
      this.sound.mission();
    }

    // Свет гаснет быстрее на 3% каждые 15 000 очков (15к, 30к, 45к, 60к, 75к…)
    let drain = DRAIN_BASE * this.skin.drainMult;
    if (this.overchargeT > 0) drain = -3.95;
    else {
      const tier = Math.floor(this.score / DARK_INTERVAL);
      drain *= 1 + DARK_STEP * tier;
    }
    this.light -= drain * dt;
    // Щит-бафф держится ограниченное время
    if (this.shield && Number.isFinite(this.shieldT)) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) {
        this.setShield(false);
        this.shieldBreakT = 0.35;
        this.showPopup('ЩИТ ИСТЁК', 0x7fd2ff, this.player.position);
      }
    }
    this.light = Math.min(MAX_LIGHT, this.light);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo > 0) {
        this.combo = 0;
        this.comboT = 0;
        this.pushHud();
      }
    }
    if (this.magnetT > 0) this.magnetT = Math.max(0, this.magnetT - dt);
    if (this.overchargeT > 0) this.overchargeT = Math.max(0, this.overchargeT - dt);

    const k = Math.max(0, this.light) / MAX_LIGHT;
    this.updateRibLook(k);
    this.updateCore(k, dt);
    this.updateZeroFx(dt);
    this.skyDome.update(this.time, k);

    const spos = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = spos.array as Float32Array;
    const sMove = move * 0.45;
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += sMove;
      if (arr[i] > 14) arr[i] -= 270;
    }
    spos.needsUpdate = true;

    const dpos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const darr = dpos.array as Float32Array;
    for (let i = 2; i < darr.length; i += 3) {
      darr[i] += move * 0.35;
      if (darr[i] > 12) darr[i] -= 272;
    }
    dpos.needsUpdate = true;
    this.dust.rotation.z += dt * 0.02;

    this.streakMat.opacity = (0.015 + d * 0.08 + this.flashFx * 0.12 + (this.flowT > 0 ? 0.08 : 0)) * this.theme.look.streak.gain;
    this.strutOuter.opacity = (0.06 + (this.flowT > 0 ? 0.06 : 0) + d * 0.03 + this.themeRich * 0.04) * 1.35;

    this.scrollZ += move;
    if (this.wallMat.map) this.wallMat.map.offset.y = -((this.scrollZ * 0.14) / WALL_TILE) % 1;
    if (this.runwayMat.map) this.runwayMat.map.offset.y = -this.scrollZ / 64;
    this.tunnelFx.update(this.time, this.scrollZ, 0.48 + 0.44 * k + (this.flowT > 0 ? 0.12 : 0));
    // Стенки и направляющие элементы тоннеля на ~35% менее прозрачные
    this.beamMat.opacity = (0.035 + d * 0.03 + k * 0.03) * 1.35;
    this.strutMat.opacity = (0.035 + k * 0.035) * 1.35;
    this.railMat.opacity = (0.08 + k * 0.12) * 1.35;
    this.runwayMat.opacity = (0.16 + k * 0.22) * 1.35;
    this.updateGuides(k);
    this.pulseHazards();
    this.driftSpace(dt);

    const sv = 0.2 + k * 0.8;
    if (this.starMatA) this.starMatA.opacity = 0.58 * sv;
    if (this.starMatB) this.starMatB.opacity = 0.32 * sv;

    this.spawnT -= dt;
    if (this.spawnT <= 0) this.spawnPattern();

    // --- Сущности (без аллокаций векторов и массивов) ---
    const pPos = this.tmpV.copy(this.player.position);
    let culled = false;
    let comboChanged = false;
    for (let idx = 0; idx < this.entities.length; idx++) {
      const e = this.entities[idx];
      if (!e.alive) {
        culled = true;
        continue;
      }
      e.z += move;
      e.spin += dt * 2 * e.dir;
      if (e.z > DESPAWN_Z) {
        this.kill(e);
        culled = true;
        continue;
      }
      if (this.magnetT > 0 && e.kind === 'orb' && e.z > -58) {
        const t = Math.min(1, Math.max(0, 1 - -e.z / 58));
        const t15 = t * Math.sqrt(t);
        const rate = 1.6 + 30 * t15;
        e.angle += wrapAngle(this.playerAngle - e.angle) * (1 - Math.exp(-rate * dt));
        e.angle += dAngle * t * t;
        e.z += move * (0.1 + 0.5 * t15);
      }
      const ea = this.effAngleOf(e);
      this.placeEntity(e, ea);

      if (e.kind === 'orb') {
        e.mesh.scale.setScalar(1 + Math.sin(e.spin * 3.2) * 0.12);
      } else if (e.kind === 'wall') {
        e.mesh.rotation.z = e.angle + e.spin * WALL_SPIN - WALL_ARC / 2;
      } else if (e.kind === 'hunter') {
        const da = wrapAngle(this.playerAngle - e.angle);
        const homing = (e.z > -48 ? 1.04 : 0.44) * 1.25;
        e.angle += Math.max(-0.85, Math.min(0.85, da)) * dt * homing;
        const sp = e.spinner ?? e.mesh;
        sp.rotation.x += dt * 1.3;
        sp.rotation.y += dt * 1.9;
      } else if (e.kind === 'shard') {
        const sp = e.spinner ?? e.mesh;
        sp.rotation.x += dt * 1.1;
        sp.rotation.y += dt * 1.6;
      } else if (e.kind === 'overcharge') {
        (e.spinner ?? e.mesh).rotation.set(0.12, Math.sin(e.spin * 1.4) * 0.7, Math.sin(e.spin * 0.9) * 0.1);
      } else if (e.kind === 'flash') {
        (e.spinner ?? e.mesh).rotation.set(0, Math.sin(e.spin * 1.5) * 0.65, 0);
      } else if (e.kind === 'shield') {
        (e.spinner ?? e.mesh).rotation.set(0.05, e.spin * 0.9, 0);
      } else {
        (e.spinner ?? e.mesh).rotation.set(e.spin, e.spin * 1.3, 0);
      }

      // Окно столкновения проверяем «заметающим» образом
      if (e.z > -1.35 && e.z - move < 1.35) {
        const da = Math.abs(wrapAngle(ea - this.playerAngle));
        const hit = e.kind === 'wall' ? da < WALL_ARC / 2 - 0.08 : e.kind === 'orb' ? da < 0.27 : e.kind === 'shard' || e.kind === 'hunter' ? da < 0.28 * OBST_SCALE : da < 0.28 * 1.1;
        if (hit) {
          this.kill(e);
          culled = true;
          if (e.kind === 'orb') {
            this.combo++;
            this.comboMax = Math.max(this.comboMax, this.combo);
            this.comboT = COMBO_HOLD;
            comboChanged = true;
            this.orbs++;
            this.light = Math.min(MAX_LIGHT, this.light + 6 * this.fx.orbLight * this.skin.orbLightMult);
            const mult = this.combo * (this.flowT > 0 ? 1.5 : 1);
            const gain = 10 * mult * this.fx.scoreMult;
            this.score += gain;
            this.spawnThemeInteraction(pPos, false);
            if (this.theme.id === 'zero') {
              this.emit(pPos, 0xf2f4f8, 8 + Math.min(this.combo, 7));
            } else {
              this.emit(pPos, 0xffe08a, 8 + Math.min(this.combo, 7));
            }
            this.sound.pickup(this.combo, this.combo >= 10);
            if (this.combo >= 5 && this.combo % 5 === 0) {
              this.showPopup(`×${this.combo} КОМБО`, 0xffd166, pPos, this.combo >= 10);
            }
          } else if (e.kind === 'shard' || e.kind === 'wall' || e.kind === 'hunter') {
            this.spawnThemeInteraction(pPos, true);
            if (this.shield) {
              this.setShield(false);
              this.shieldBreakT = 0.35;
              this.emit(pPos, 0x7fd2ff, 22, 1.7);
              this.showPopup('ЩИТ ОТБИЛ УДАР', 0x3ea8ff, pPos);
              this.sound.shieldBreak();
            } else if (this.wardenCharges > 0) {
              // Бафф «Пепельный оберег»: первый удар не гасит свет и не сбрасывает комбо
              this.wardenCharges--;
              this.wardenBreakT = 0.5;
              this.shake = 0.18;
              this.emit(pPos, 0xd8cba6, 6, 0.8);
              this.showPopup('ОБЕРЕГ', 0xd9b36a, pPos);
              this.sound.powerup();
            } else {
              // Каждые 20 000 очков урон от препятствий увеличивается на +1 единицу
              const extraDmg = Math.floor(this.score / 20000);
              const damage = 26 + extraDmg;
              this.light -= damage;
              this.shake = 1;
              this.emit(pPos, this.theme.warm ? 0x7ff2ea : 0xff2f74, 18, 1.5);
              this.showPopup('УДАР', 0xff3d5a, pPos);
              if (this.absorb) {
                this.absorb = false;
              } else {
                this.combo = 0;
                this.comboT = 0;
                comboChanged = true;
              }
              this.sound.hit();
            }
          } else if (e.kind === 'flash') {
            let n = 0;
            for (let j = 0; j < this.entities.length; j++) {
              const o = this.entities[j];
              if (o.alive && (o.kind === 'shard' || o.kind === 'hunter') && o.z > -95) {
                o.mesh.getWorldPosition(this.tmpV2);
                this.emit(this.tmpV2, 0xfff09a, 3, 0.8);
                this.spawnThemeInteraction(this.tmpV2, true);
                this.kill(o);
                n++;
              }
            }
            culled = true;
            this.powerups++;
            this.score += 23 * n + 56;
            this.light = Math.min(MAX_LIGHT, this.light + 17);
            this.flashFx = 1;
            this.spawnBuffInteraction(pPos, 'flash');
            this.emit(pPos, 0xffe14d, 14, 1.15);
            this.showPopup(`ВСПЫШКА +${23 * n + 56}`, 0xfff09a, pPos);
            this.sound.flash();
          } else if (e.kind === 'magnet') {
            this.magnetT = this.magnetDur;
            this.powerups++;
            this.score += 56;
            this.spawnBuffInteraction(pPos, 'magnet');
            this.emit(pPos, 0xc3aaff, 12, 1.05);
            this.showPopup('МАГНИТ', 0xa77bff, pPos);
            this.sound.powerup();
          } else if (e.kind === 'shield') {
            this.setShield(true, SHIELD_DUR);
            this.powerups++;
            this.score += 56;
            this.spawnBuffInteraction(pPos, 'shield');
            this.emit(pPos, 0x7fd2ff, 14, 1.1);
            this.showPopup(`ЩИТ ${SHIELD_DUR}с`, 0x3ea8ff, pPos);
            this.sound.shield();
          } else if (e.kind === 'overcharge') {
            this.overchargeT = 4.7;
            this.powerups++;
            this.score += 56;
            this.spawnBuffInteraction(pPos, 'overcharge');
            this.emit(pPos, 0x7dff6a, 12, 1.05);
            this.showPopup('ПЕРЕЗАРЯД', 0x4ade50, pPos);
            this.sound.charge();
          }
        } else if (
          !e.missed &&
          ((e.kind === 'shard' && da < 0.64) || (e.kind === 'hunter' && da < 0.64) || (e.kind === 'wall' && da < WALL_ARC / 2 + 0.26))
        ) {
          // Проход «ВПРИТИРКУ» — без анимации взаимодействия
          e.missed = true;
          this.nearMiss++;
          this.score += (25 + this.combo * 2) * this.fx.scoreMult;
          this.flowStack++;
          this.flowStackT = FLOW_STACK;
          if (this.flowStack >= 3 && this.flowT <= 0.2) {
            this.flowStack = 0;
            this.flowT = FLOW_TIME;
            this.flowMax = Math.max(this.flowMax, 1);
            this.showPopup('ПОТОК ×1.5', 0x2de0c0, pPos, true);
            this.emit(pPos, 0x6ef7d8, 16, 1.2);
            this.flashFx = 0.6;
            this.sound.flow();
          }
          this.light = Math.min(MAX_LIGHT, this.light + 1.6);
          this.showPopup('ВПРИТИРКУ +25', 0xff9f43, pPos);
          this.sound.nearMiss();
        }
      }
    }
    if (culled) {
      let write = 0;
      for (let i = 0; i < this.entities.length; i++) {
        if (this.entities[i].alive) this.entities[write++] = this.entities[i];
      }
      this.entities.length = write;
    }

    // --- Частицы и всплывашки ---
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.addScaledVector(p.vel, dt);
      (p.sprite.material as THREE.SpriteMaterial).opacity = p.life / p.maxLife;
    }
    // --- Свет, анимация текстурированной искры и камеры (улучшенная видимость в конце тоннеля при 100% света) ---
    this.fog.density = this.fogBase + (1 - k) * (1 - k) * 0.036 * FOG_K;
    this.ambient.intensity = (0.42 + k * 0.68) * this.ambK * AMB_K;
    this.playerLight.intensity = (16 + k * 58 + this.flashFx * 90) * this.lightK;
    const flicker = k < 0.26 ? 0.58 + Math.abs(Math.sin(this.time * 10)) * 0.42 : 1;

    this.sparkRig.update(dt, this.time, k * flicker, d);

    const glowMat = this.playerGlow.material as THREE.SpriteMaterial;
    this.playerGlow.scale.setScalar((2.1 + k * 1.65 + Math.sin(this.time * 7) * 0.13) * (this.skin.shape === 'star' ? 0.82 : 1) + this.flashFx * 3.0);
    glowMat.opacity = (0.45 + k * 0.55) * flicker;
    glowMat.color.setHex(this.magnetT > 0 ? 0xd9c6ff : 0xffffff);
    glowMat.rotation = this.time * 0.25;

    (this.auraMesh.material as THREE.MeshBasicMaterial).opacity = this.combo >= 3 ? Math.min(0.85, this.combo * 0.09) : 0;
    this.auraMesh.rotation.z += dt * 3;
    this.auraMesh.scale.setScalar(1 + Math.sin(this.time * 6) * 0.08 + this.comboT * 0.2);

    // Эффекты баффов компактнее на «Сверхновой»: у неё и так богатая модель
    const buffK = this.skin.shape === 'star' ? 0.74 : 1;

    // Щит
    if (this.shield) {
      this.shieldGroup.visible = true;
      this.shieldGroup.scale.setScalar(buffK * (1 + Math.sin(this.time * 3.2) * 0.03));
      this.shieldGroup.rotation.y += dt * 0.9;
      this.shieldGroup.children[1].rotation.y = -this.shieldGroup.rotation.y; // контур всегда лицом к камере
      const gA = this.shieldGroup.children[2] as THREE.Mesh;
      const gB = this.shieldGroup.children[3] as THREE.Mesh;
      gA.rotation.x += dt * 1.7;
      gA.rotation.z += dt * 0.6;
      gB.rotation.y += dt * 1.4;
      // последние 3 секунды щит мигает — предупреждает, что скоро исчезнет
      this.setShieldOpacity(Number.isFinite(this.shieldT) && this.shieldT < 3 ? 0.55 + 0.45 * Math.abs(Math.sin(this.time * 9)) : 1);
    } else if (this.shieldBreakT > 0) {
      this.shieldBreakT -= dt;
      const bk = Math.max(0, this.shieldBreakT / 0.35);
      this.shieldGroup.visible = true;
      this.shieldGroup.scale.setScalar(buffK * (1 + (1 - bk) * 1.1));
      this.setShieldOpacity(bk);
      if (this.shieldBreakT <= 0) this.shieldGroup.visible = false;
    } else {
      this.shieldGroup.visible = false;
    }

    // Магнит
    if (this.magnetT > 0) {
      this.magnetPop = Math.min(1, this.magnetPop + dt * 4);
      const ease = 1 - (1 - this.magnetPop) ** 3;
      this.magnetGroup.visible = true;
      this.magnetGroup.rotation.y += dt * 3.4;
      this.magnetGroup.rotation.x = Math.sin(this.time * 1.6) * 0.3;
      this.magnetGroup.scale.setScalar(buffK * (0.5 + 0.5 * ease));
      for (let i = 0; i < this.magnetArcs.length; i++) {
        const a = this.magnetArcs[i];
        (a.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.abs(Math.sin(this.time * 4.5 + i * 1.7)) * 0.4;
        a.rotation.z += dt * (1.2 + i * 0.5);
      }
      this.magnetSpawnT -= dt;
      if (this.magnetSpawnT <= 0) {
        this.magnetSpawnT = 0.24;
        this.spawnAttractionParticle();
      }
    } else {
      this.magnetGroup.visible = false;
      this.magnetPop = 0;
    }

    // «Пепельный оберег»: пока заряд цел — тонкое кольцо с медленными рисками; при ударе — один чистый круг-импульс
    if (this.wardenCharges > 0) {
      this.wardenSpin += dt * 0.5;
      this.wardenGroup.visible = true;
      this.wardenGroup.scale.setScalar(1 + Math.sin(this.time * 2.4) * 0.015);
      this.wardenTicks.rotation.z = this.wardenSpin;
      for (const m of this.wardenMats) m.mat.opacity = m.base * (0.85 + 0.15 * Math.sin(this.time * 2.4));
    } else if (this.wardenBreakT > 0) {
      this.wardenBreakT = Math.max(0, this.wardenBreakT - dt);
      const bp = 1 - this.wardenBreakT / 0.5;
      this.wardenGroup.visible = this.wardenBreakT > 0;
      this.wardenGroup.scale.setScalar(1 + bp * 1.1);
      this.wardenTicks.rotation.z = this.wardenSpin + bp * 0.6;
      const fade = (1 - bp) * (1 - bp);
      for (const m of this.wardenMats) m.mat.opacity = m.base * fade;
    } else {
      this.wardenGroup.visible = false;
    }

    if (this.skin.shape === 'flame' || this.skin.shape === 'star') {
      this.emberT -= dt;
      if (this.emberT <= 0) {
        this.emberT = this.skin.shape === 'flame' ? 0.14 : 0.07;
        this.spawnEmber();
      }
    }
    if (this.skin.shape === 'star') {
      // Ударная волна в такт с кольцами на модели + радужный шлейф
      const ph = Math.floor(this.time / STAR_PERIOD);
      if (ph !== this.novaPhase) {
        this.novaPhase = ph;
        this.spawnNovaBurst();
      }
      for (let i = 0; i < this.trail.length; i++) {
        const hue = (this.time * 0.12 + i * 0.045) % 1;
        const tc = (this.trail[i].material as THREE.SpriteMaterial).color;
        tc.setHSL(0.1 + 0.5 * (0.5 + 0.5 * Math.sin(hue * Math.PI * 2)), 0.85, 0.62);
      }
    }

    this.flashFx = Math.max(0, this.flashFx - dt * 2.2);

    this.updateTrail(dt, diff);

    this.shake = Math.max(0, this.shake - dt * 3.1);
    const amp = this.shake * 0.4 + (k < 0.18 ? 0.05 : 0);
    this.camera.position.set((Math.random() - 0.5) * amp, this.baseCamY + (Math.random() - 0.5) * amp, this.baseCamZ);
    this.camera.lookAt(this.camTarget);

    const targetFov = this.baseFov + d * 11 + this.flashFx * 6 + (this.flowT > 0 ? 4 : 0);
    const nextFov = this.camera.fov + (targetFov - this.camera.fov) * (1 - Math.exp(-8 * dt));
    if (Math.abs(nextFov - this.camera.fov) > 0.04) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.sound.setIntensity(d, 1 - k);

    // Обновляем живые данные сонара каждый кадр для абсолютно плавного 60/120 FPS движения
    this.updateLiveSonar();

    this.hudT += dt;
    if (comboChanged || this.hudT > 0.1) {
      this.hudT = 0;
      this.pushHud(true);
    }

    if (this.light <= 0) {
      this.light = 0;
      this.gameOver();
    }
  }

  /**
   * Шлейф искры. Герой «ездит» по окружности тоннеля, поэтому каждое звено цепочки запоминает угол
   * и догоняет голову с запаздыванием — при движении вбок за искрой тянется изогнутый хвост,
   * в покое он схлопывается и почти не виден.
   */
  private updateTrail(dt: number, diff: number) {
    this.updateTail(dt, diff);
    const lateral = Math.min(1, Math.abs(diff) * 5.5); // 0..1 — насколько активно мы сейчас смещаемся
    this.trailVis += (lateral - this.trailVis) * (1 - Math.exp(-9 * dt));
    const lag = 1 - Math.exp(-dt * 13);
    this.trailAng[0] = this.playerAngle;
    for (let i = 1; i < this.trail.length; i++) {
      this.trailAng[i] += wrapAngle(this.trailAng[i - 1] - this.trailAng[i]) * lag;
    }
    // Боковой шлейф-цепочка отключён: остаётся только метеорный хвост (updateTail),
    // а лаговые углы trailAng нужны хвосту, чтобы изгибаться на виражах.
    for (let i = 0; i < this.trail.length; i++) this.trail[i].visible = false;
  }

  /**
   * Метеорный хвост под искрой: цепочка мягких огней, уходящая вниз и к камере. Сужается и гаснет к концу;
   * на виражах изгибается вслед за лаговым шлейфом. С ростом скорости — длиннее и ярче.
   */
  private updateTail(dt: number, diff: number) {
    const sk = this.speedK();
    const boost = this.overchargeT > 0 ? 1.25 : 1;
    const target = (2.1 + sk * 1.1) * boost;
    this.tailLen += (target - this.tailLen) * (1 - Math.exp(-8 * dt));
    const bend = Math.min(1, Math.abs(diff) * 4);
    const star = this.skin.shape === 'star';
    for (let i = 0; i < this.tail.length; i++) {
      const sp = this.tail[i];
      const mat = sp.material as THREE.SpriteMaterial;
      const k = i / (this.tail.length - 1); // 0 — у искры, 1 — кончик хвоста
      // угол звена берём из лагового шлейфа — хвост гнётся при повороте
      const chain = Math.min(this.trailAng.length - 1, Math.round(k * (this.trailAng.length - 1)));
      const rel = wrapAngle(this.trailAng[chain] - this.playerAngle) * bend;
      const a = -Math.PI / 2 + rel;
      const fall = k * this.tailLen;
      sp.position.set(Math.cos(a) * PLAYER_R, Math.sin(a) * PLAYER_R - fall * 0.85, 0.15 + fall * 0.5);
      const size = (0.95 - 0.78 * k) * PLAYER_SCALE * (1 + sk * 0.15);
      sp.scale.set(size * 0.9, size * 1.25, 1);
      mat.opacity = (0.5 * (1 - k) * (1 - k) + 0.02) * (1 - 0.2 * bend);
      if (star) mat.color.setHSL(0.1 + 0.5 * (0.5 + 0.5 * Math.sin(((this.time * 0.12 + k * 0.4) % 1) * Math.PI * 2)), 0.85, 0.66);
      else mat.color.setHex(this.skin.trail).lerp(this.tmpC.setHex(0xffffff), (1 - k) * 0.35);
      sp.visible = true;
    }
  }

  private idleUpdate(dt: number) {
    const move = 5 * dt;
    this.time += dt;
    this.updateRibLook(1);
    this.updateCore(1, dt);
    this.updateZeroFx(dt);
    this.skyDome.update(this.time, 1);

    const spos = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = spos.array as Float32Array;
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += move * 0.6;
      if (arr[i] > 14) arr[i] -= 270;
    }
    spos.needsUpdate = true;

    const dpos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const di = dpos.array as Float32Array;
    for (let i = 2; i < di.length; i += 3) {
      di[i] += move * 0.4;
      if (di[i] > 12) di[i] -= 272;
    }
    dpos.needsUpdate = true;

    this.streakMat.opacity = 0.02;
    this.world.rotation.z += dt * 0.09;
    this.scrollZ += move;
    if (this.wallMat.map) this.wallMat.map.offset.y = -((this.scrollZ * 0.14) / WALL_TILE) % 1;
    if (this.runwayMat.map) this.runwayMat.map.offset.y = -this.scrollZ / 18;
    this.tunnelFx.update(this.time, this.scrollZ, 0.62);
    this.beamMat.opacity = 0.095;
    this.strutMat.opacity = 0.095;
    this.railMat.opacity = 0.14;
    this.runwayMat.opacity = 0.36;
    this.guidePlayer.visible = false;
    this.pulseHazards();
    for (const g of this.guideThreats) g.visible = false;
    this.driftSpace(dt);
    if (this.starMatA) this.starMatA.opacity = 0.65;
    if (this.starMatB) this.starMatB.opacity = 0.36;

    this.player.position.set(Math.cos(this.time * 0.5) * 0.12, -PLAYER_R + Math.sin(this.time * 1.4) * 0.16, 0);
    this.sparkRig.update(dt, this.time, 1, 0.2);

    const glowMat = this.playerGlow.material as THREE.SpriteMaterial;
    this.playerGlow.scale.setScalar(3.0 + Math.sin(this.time * 3) * 0.3);
    glowMat.opacity = 0.92;
    glowMat.rotation = this.time * 0.22;

    (this.auraMesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(this.time * 2) * 0.12;
    this.auraMesh.rotation.z += dt * 0.6;
    this.playerLight.intensity = (34 + Math.sin(this.time * 2.2) * 8) * this.lightK;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) p.sprite.visible = false;
      else p.sprite.position.addScaledVector(p.vel, dt);
    }
    for (let i = 0; i < this.trail.length; i++) this.trail[i].visible = false;
    for (let i = 0; i < this.tail.length; i++) this.tail[i].visible = false;
    this.wardenGroup.visible = false;
    this.trailAng.fill(this.playerAngle);
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      e.z += move;
      if (e.z > DESPAWN_Z) this.kill(e);
      else this.placeEntity(e, this.effAngleOf(e));
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = Math.min(MAX_DT, Math.max(0, (now - this.lastT) / 1000));
    this.lastT = now;
    if (rawDt > 0) {
      const blend = Math.abs(rawDt - this.smoothDt) < 0.012 ? 0.22 : 0.65;
      this.smoothDt += (rawDt - this.smoothDt) * blend;
    }
    const dt = Math.min(MAX_DT, this.smoothDt);

    // Если поверх открыт полноэкранный Магазин / 3D-осмотр и забег не идёт — не тратим GPU телефона
    if (this.overlayOpen && (!this.running || this.paused || this.over)) {
      return;
    }

    if (this.running && !this.paused && !this.over) {
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    } else if (!this.running && !this.over) {
      this.idleUpdate(dt);
      this.renderer.render(this.scene, this.camera);
    } else if (this.needsStaticRender) {
      this.needsStaticRender = false;
      this.renderer.render(this.scene, this.camera);
    }
  };
}
