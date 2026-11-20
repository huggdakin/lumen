import * as THREE from 'three';
import { Sound } from './Sound';
import { buildSparkRig, type SparkRig } from './sparkSkins';
import { skinById, type Skin } from './state';
import { THEMES, themeById, type Theme, type LoadoutFx, emptyFx } from './economy';
import {
  WALL_TILE,
  buildRibGeos,
  createRibMats,
  disposeRibGeos,
  makeRaysTexture,
  makeThinRingTexture,
  mergeSimpleGeometries,
  paintWallTexture,
  renderThemePreview,
  ribPieces,
  type RibGeos,
  type RibMats,
} from './tunnels';

export interface RadarDot {
  x: number; // 0..1 по горизонтали (центр = позиция игрока)
  y: number; // 0..1 по глубине (1 = прямо перед нами)
  k: 0 | 1 | 2; // 0 — препятствие, 1 — светлячок, 2 — бафф
}

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

type Kind = 'orb' | 'shard' | 'flash' | 'magnet' | 'overcharge' | 'wall' | 'drifter';

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
}

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Popup {
  sprite: THREE.Sprite;
  tex: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  life: number;
  maxLife: number;
  w: number;
  h: number;
}

interface SharedEntityAssets {
  orbCoreGeo: THREE.SphereGeometry;
  orbCoreMat: THREE.MeshBasicMaterial;
  orbGlowMat: THREE.SpriteMaterial;

  shardGeo: THREE.OctahedronGeometry;
  shardMat: THREE.MeshLambertMaterial;
  shardEdgesGeo: THREE.EdgesGeometry;
  shardEdgeMat: THREE.LineBasicMaterial;
  shardGlowMat: THREE.SpriteMaterial;

  flashGeo: THREE.IcosahedronGeometry;
  flashMat: THREE.MeshBasicMaterial;
  flashGlowMat: THREE.SpriteMaterial;

  magnetUGeo: THREE.TorusGeometry;
  magnetUMat: THREE.MeshLambertMaterial;
  magnetTipGeo: THREE.CylinderGeometry;
  magnetTipMat: THREE.MeshLambertMaterial;
  magnetGlowMat: THREE.SpriteMaterial;

  drifterCoreGeo: THREE.OctahedronGeometry;
  drifterCoreMat: THREE.MeshLambertMaterial;
  drifterLegsGeo: THREE.BufferGeometry;
  drifterLegsMat: THREE.LineBasicMaterial;
  drifterGlowMat: THREE.SpriteMaterial;

  overCellGeo: THREE.CylinderGeometry;
  overCellMat: THREE.MeshLambertMaterial;
  overCapGeo: THREE.CylinderGeometry;
  overCapMat: THREE.MeshBasicMaterial;
  overRingGeo: THREE.TorusGeometry;
  overRingMat: THREE.MeshBasicMaterial;
  overGlowMat: THREE.SpriteMaterial;

  wallArcGeo: THREE.TorusGeometry;
  wallArcMat: THREE.MeshLambertMaterial;
  wallRimGeo: THREE.TorusGeometry;
  wallRimMat: THREE.MeshBasicMaterial;
  wallGlowMat: THREE.SpriteMaterial;
  wallOutlineGeo: THREE.TorusGeometry;
  wallOutlineMat: THREE.MeshBasicMaterial;
  haloMat: THREE.SpriteMaterial;
  haloSoftMat: THREE.SpriteMaterial;
}

const TUNNEL_R = 5;
const PLAYER_R = 4.0;
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
const FLOW_TIME = 6;
const FLOW_STACK = 4;
const WALL_ARC = 3.7; // ~212° занимает стена, остальное — зев
const WALL_SPIN = 0.48; // рад/с вращения стены на единицу спина (+20% динамики)
const POP_W = 560;
const POP_H = 140;

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

/** Цвета опасных объектов: обычная (розово-красная + оранжевый дрейфун) и холодная для красных/оранжевых тоннелей. */
const HAZARD_NORMAL = {
  shardBody: 0x1a092b, shardEm: 0x820046, shardEdge: 0xff2f74, shardGlow: 0xff2f74,
  wallBody: 0x2a0a1e, wallEm: 0xff2f74, wallRim: 0xff5c8a, wallGlow: 0xff2f74,
  driftBody: 0x2b1000, driftEm: 0xff7a14, driftLeg: 0xff9a2e, driftGlow: 0xff8a1f,
};
const HAZARD_COLD = {
  shardBody: 0x06122c, shardEm: 0x1f58c8, shardEdge: 0xe6f4ff, shardGlow: 0x7fb4ff,
  wallBody: 0x06122c, wallEm: 0x2a62d8, wallRim: 0xe6f4ff, wallGlow: 0x7fb4ff,
  driftBody: 0x06122c, driftEm: 0x3f86ff, driftLeg: 0xcfe6ff, driftGlow: 0x8fc0ff,
};

function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  const S = 64;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const c = cvs.getContext('2d')!;
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(210,230,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
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
  private rings: THREE.Group[] = [];
  private ribGeos: RibGeos | null = null;
  private ribMats: RibMats = createRibMats();
  private beamMeshes: THREE.Mesh[] = [];
  private coreGlow!: THREE.Sprite;
  private coreRays!: THREE.Sprite;
  private coreRing!: THREE.Sprite;
  private raysTex!: THREE.Texture;
  private ringTex!: THREE.Texture;
  private fogBase = 0.011;
  private ambK = 1;
  private lightK = 1;
  private tmpC = new THREE.Color();
  private tmpC2 = new THREE.Color();
  private wall: THREE.Mesh;
  private wallMat: THREE.MeshBasicMaterial;
  private beamMat: THREE.MeshBasicMaterial;
  private strutMat: THREE.MeshBasicMaterial;
  private runway: THREE.Mesh;
  private runwayMat: THREE.MeshBasicMaterial;
  private railMat: THREE.MeshBasicMaterial;
  private space: THREE.Group;
  private planets: THREE.Mesh[] = [];
  private planetR: number[] = [];
  private strutOuter: THREE.MeshBasicMaterial;
  private streaks: THREE.Points;
  private streakMat: THREE.PointsMaterial;
  private entities: Entity[] = [];
  private entityPool = new Map<Kind, Entity[]>();
  private assets: SharedEntityAssets;
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private glowTex: THREE.Texture;
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
  private auraMesh: THREE.Mesh;
  private trail: THREE.Sprite[] = [];

  private ambient: THREE.AmbientLight;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private camTarget = new THREE.Vector3(0, -0.9, -20);

  private playerAngle = -Math.PI / 2;
  private targetAngle = -Math.PI / 2;
  private keyDir = 0;
  private leftHeld = false;
  private rightHeld = false;
  private dragging = false;
  private pointerId = -1;
  private lastPointerX = 0;

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
  private absorb = false;
  private wardenCharges = 0;
  private spawnT = 0.5;
  private patternMinZ = SPAWN_Z; // самая дальняя точка последней волны (для расчёта просвета)
  private firstSpawn = true;
  private time = 0;
  private scrollZ = 0;
  private bestTarget = 0;
  private shake = 0;
  private flashFx = 0;
  private skin: Skin = skinById('spark');
  private theme: Theme = themeById('pulse');
  private themeRich = 0.5;
  private wallCache = new Map<string, THREE.Texture>();
  private nebulae: THREE.Sprite[] = [];
  private starMatA: THREE.PointsMaterial | null = null;
  private starMatB: THREE.PointsMaterial | null = null;
  private flowT = 0;
  private flowStack = 0;
  private flowStackT = 0;
  private flowMax = 0;
  private fx: LoadoutFx = emptyFx();
  private dust: THREE.Points;
  private beatBest = false;

  // Авто-адаптация разрешения при просадках FPS
  private curDpr = 1;
  private maxDpr = 1.75;
  private fpsAccum = 0;
  private fpsFrames = 0;

  private running = false;
  private paused = false;
  private over = false;
  private lastT = 0;
  private raf = 0;
  private hudT = 0;
  private disposed = false;

  public sound: Sound;

  private canvasEl: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    private callbacks: {
      onHud: (h: HudState) => void;
      onGameOver: (r: GameResult) => void;
    }
  ) {
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.curDpr = this.maxDpr;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.maxDpr <= 1.35,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setPixelRatio(this.curDpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.fog = new THREE.FogExp2(0x060814, 0.011);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 0.8, 7);
    this.camera.lookAt(0, -0.9, -20);

    this.glowTex = makeGlowTexture();
    this.darkTex = makeDarkHaloTexture();
    this.assets = this.buildSharedAssets();

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.ambient = new THREE.AmbientLight(0x7d95e8, 0.95);
    this.scene.add(this.ambient);

    // --- Космос снаружи ---
    this.space = new THREE.Group();
    this.scene.add(this.space);

    const starTex = makeStarTexture();
    const SN = 900;
    const sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const r = 90 + Math.random() * 130;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(b) * Math.cos(a);
      sp[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
      sp[i * 3 + 2] = r * Math.cos(b);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starA = new THREE.PointsMaterial({
      map: starTex,
      size: 2.3,
      sizeAttenuation: false,
      color: 0xc9dbff,
      transparent: true,
      opacity: 0.72,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const SNB = 320;
    const spB = new Float32Array(SNB * 3);
    for (let i = 0; i < SNB; i++) {
      const r = 95 + Math.random() * 120;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      spB[i * 3] = r * Math.sin(b) * Math.cos(a);
      spB[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
      spB[i * 3 + 2] = r * Math.cos(b);
    }
    const starGeoB = new THREE.BufferGeometry();
    starGeoB.setAttribute('position', new THREE.BufferAttribute(spB, 3));
    const starB = new THREE.PointsMaterial({
      map: starTex,
      size: 5.4,
      sizeAttenuation: false,
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.34,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.space.add(new THREE.Points(starGeo, starA));
    this.space.add(new THREE.Points(starGeoB, starB));

    this.starMatA = starA;
    this.starMatB = starB;
    const planetDefs = THEMES[0].planets.map((p) => ({ r: p.r, pos: [p.x, p.y, p.z], color: p.color, emissive: p.emissive }));
    for (const pd of planetDefs) {
      this.planetR.push(pd.r);
      const pl = new THREE.Mesh(
        new THREE.SphereGeometry(pd.r, 18, 14),
        new THREE.MeshLambertMaterial({
          color: pd.color,
          emissive: pd.emissive,
          emissiveIntensity: 1.5,
          fog: false,
        })
      );
      pl.position.set(pd.pos[0], pd.pos[1], pd.pos[2]);
      this.space.add(pl);
      this.planets.push(pl);
    }

    for (const [x, y, sc] of [
      [70, 40, 155],
      [-80, -30, 102],
      [12, -92, 130],
    ] as const) {
      const neb = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: THEMES[0].nebula,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      neb.position.set(x * 1.4, y * 1.4, -260);
      neb.scale.setScalar(sc);
      this.space.add(neb);
      this.nebulae.push(neb);
    }

    // --- Обшивка тоннеля ---
    const wallGeo = new THREE.CylinderGeometry(TUNNEL_R + 0.4, TUNNEL_R + 0.4, WALL_LEN, 48, 1, true);
    wallGeo.rotateX(Math.PI / 2);
    const wallTex = this.wallTexture(this.theme);
    this.wallMat = new THREE.MeshBasicMaterial({
      map: wallTex,
      side: THREE.BackSide,
      transparent: false,
      alphaTest: 0.4,
      depthWrite: true,
    });
    this.wall = new THREE.Mesh(wallGeo, this.wallMat);
    this.wall.position.z = WALL_Z;
    this.wall.renderOrder = -1;
    this.world.add(this.wall);

    // Продольные направляющие лучи — 2 меша, число и толщина зависят от тоннеля
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x5f8cff, transparent: true, opacity: 0.3, fog: true });
    this.strutMat = new THREE.MeshBasicMaterial({ color: 0x3c4f9e, transparent: true, opacity: 0.32, fog: true });
    this.rebuildBeams(this.theme.look.beams.count, this.theme.look.beams.width);

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
    const runGeo = new THREE.CylinderGeometry(TUNNEL_R - 0.04, TUNNEL_R - 0.04, 420, 8, 1, true, -Math.PI / 2 - 0.17, 0.34);
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
    for (let i = 0; i < 8; i++) {
      const sg = new THREE.TorusGeometry(TUNNEL_R + 1.05, 0.05, 3, 28);
      sg.translate(0, 0, -i * 46);
      strutGeos.push(sg);
    }
    this.strutOuter = new THREE.MeshBasicMaterial({ color: 0x35488f, transparent: true, opacity: 0.2 });
    this.world.add(new THREE.Mesh(mergeSimpleGeometries(strutGeos), this.strutOuter));

    // Рёбра тоннеля: группы-слоты по 8 м; состав каждого слота задаёт ритм выбранного тоннеля
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = new THREE.Group();
      ring.position.z = -i * RING_GAP;
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
      color: 0xffb03a,
      size: 0.09,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
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
        color: 0xffffff,
        vertexColors: true,
        size: 0.07,
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
      new THREE.TorusGeometry(0.76, 0.028, 4, 36),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.player.add(this.auraMesh);

    this.playerLight = new THREE.PointLight(this.skin.light, 40, 34, 1.6);
    this.player.add(this.playerLight);

    // Щит
    this.shieldGroup = new THREE.Group();
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0x6ef7d8, transparent: true, opacity: 0.13, depthWrite: false });
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), bubbleMat);
    const cage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.03, 1),
      new THREE.MeshBasicMaterial({ color: 0x6ef7d8, transparent: true, opacity: 0.5, wireframe: true, depthWrite: false })
    );
    const gyroA = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.03, 5, 36),
      new THREE.MeshBasicMaterial({ color: 0x9ffce8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    gyroA.rotation.x = Math.PI / 2.2;
    const gyroB = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.02, 5, 36),
      new THREE.MeshBasicMaterial({ color: 0x6ef7d8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    gyroB.rotation.y = Math.PI / 3;
    const shieldGlow = this.glowSprite(0x6ef7d8, 3.6, 0.4);
    this.shieldGroup.add(bubble, cage, gyroA, gyroB, shieldGlow);
    this.shieldGroup.visible = false;
    this.player.add(this.shieldGroup);
    this.shieldMats = [
      { mat: bubbleMat, base: 0.13 },
      { mat: cage.material as THREE.Material, base: 0.5 },
      { mat: gyroA.material as THREE.Material, base: 0.85 },
      { mat: gyroB.material as THREE.Material, base: 0.6 },
      { mat: shieldGlow.material as THREE.Material, base: 0.4 },
    ];

    // Магнит
    this.magnetGroup = new THREE.Group();
    const mRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.05, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xc3aaff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mRing1.rotation.x = 1.1;
    const mRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.03, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x8b62ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mRing2.rotation.x = -0.6;
    this.magnetGroup.add(mRing1, mRing2);
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(1.38, 0.02, 5, 22, Math.PI * 0.55),
        new THREE.MeshBasicMaterial({ color: 0xc3aaff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      arc.rotation.set(i * 1.1, i * 2.1, i * 0.7);
      this.magnetGroup.add(arc);
      this.magnetArcs.push(arc);
    }
    this.magnetGroup.visible = false;
    this.player.add(this.magnetGroup);

    // Шлейф за искрой
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: this.skin.trail,
          transparent: true,
          opacity: Math.max(0.05, 0.48 - i * 0.044),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      s.scale.setScalar((1.65 - i * 0.12) * PLAYER_SCALE);
      this.scene.add(s);
      this.trail.push(s);
    }

    // Пул частиц
    for (let i = 0; i < 72; i++) {
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

    // Пул всплывающих надписей
    for (let i = 0; i < 8; i++) {
      const cvs = document.createElement('canvas');
      cvs.width = POP_W;
      cvs.height = POP_H;
      const c = cvs.getContext('2d')!;
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          blending: THREE.NormalBlending,
          depthWrite: false,
          depthTest: false,
          fog: false,
        })
      );
      s.visible = false;
      s.renderOrder = 30;
      s.scale.set(3.4, 0.95, 1);
      this.scene.add(s);
      this.popups.push({ sprite: s, tex, ctx: c, life: 0, maxLife: 1, w: 3.4, h: 0.95 });
    }

    this.canvasEl = canvas;
    this.sound = new Sound();
    this.bindEvents(canvas);
    this.setTheme(this.theme.id);
    renderer.render(this.scene, this.camera);
    this.loop(performance.now());
  }

  /** Общие геометрии и материалы всех объектов тоннеля — создаются 1 раз. */
  private buildSharedAssets(): SharedEntityAssets {
    const shardGeo = new THREE.OctahedronGeometry(0.8, 0);
    const shardEdgesGeo = new THREE.EdgesGeometry(shardGeo);

    // 6 щупалец Дрейфуна в едином буфере LineSegments (1 draw call вместо 6)
    const legPts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const mx = Math.cos(a) * 0.6;
      const my = Math.sin(a) * 0.6;
      const ex = Math.cos(a) * 1.1;
      const ey = Math.sin(a) * 1.1;
      legPts.push(0, 0, 0, mx, my, 0, mx, my, 0, ex, ey, 0.2);
    }
    const drifterLegsGeo = new THREE.BufferGeometry();
    drifterLegsGeo.setAttribute('position', new THREE.Float32BufferAttribute(legPts, 3));

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
      orbCoreGeo: new THREE.SphereGeometry(0.15, 10, 8),
      orbCoreMat: new THREE.MeshBasicMaterial({ color: 0xfff9e6 }),
      orbGlowMat: mkGlowMat(0xffd678, 0.95),

      shardGeo,
      shardMat: new THREE.MeshLambertMaterial({ color: HAZARD_NORMAL.shardBody, emissive: HAZARD_NORMAL.shardEm, emissiveIntensity: 1.1 }),
      shardEdgesGeo,
      shardEdgeMat: new THREE.LineBasicMaterial({ color: HAZARD_NORMAL.shardEdge }),
      shardGlowMat: mkGlowMat(HAZARD_NORMAL.shardGlow, 0.55),

      flashGeo: new THREE.IcosahedronGeometry(0.42, 0),
      flashMat: new THREE.MeshBasicMaterial({ color: 0x6ef7d8, wireframe: true }),
      flashGlowMat: mkGlowMat(0x6ef7d8, 1),

      magnetUGeo: new THREE.TorusGeometry(0.4, 0.13, 8, 20, Math.PI),
      magnetUMat: new THREE.MeshLambertMaterial({ color: 0x8b62ff, emissive: 0x6a3cf0, emissiveIntensity: 1.05 }),
      magnetTipGeo: new THREE.CylinderGeometry(0.15, 0.15, 0.24, 8),
      magnetTipMat: new THREE.MeshLambertMaterial({ color: 0xe8ecff, emissive: 0xc3aaff, emissiveIntensity: 0.85 }),
      magnetGlowMat: mkGlowMat(0xc3aaff, 1),

      drifterCoreGeo: new THREE.OctahedronGeometry(0.55, 0),
      drifterCoreMat: new THREE.MeshLambertMaterial({ color: HAZARD_NORMAL.driftBody, emissive: HAZARD_NORMAL.driftEm, emissiveIntensity: 1.0 }),
      drifterLegsGeo,
      drifterLegsMat: new THREE.LineBasicMaterial({ color: HAZARD_NORMAL.driftLeg, transparent: true, opacity: 0.95 }),
      drifterGlowMat: mkGlowMat(HAZARD_NORMAL.driftGlow, 0.65),

      overCellGeo: new THREE.CylinderGeometry(0.26, 0.26, 0.6, 10),
      overCellMat: new THREE.MeshLambertMaterial({ color: 0x0d3a12, emissive: 0x39ff6a, emissiveIntensity: 0.95 }),
      overCapGeo: new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8),
      overCapMat: new THREE.MeshBasicMaterial({ color: 0xd6ffe0 }),
      overRingGeo: new THREE.TorusGeometry(0.52, 0.035, 5, 24),
      overRingMat: new THREE.MeshBasicMaterial({
        color: 0x7dff6a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      overGlowMat: mkGlowMat(0x7dff6a, 1),

      wallArcGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14, 0.42, 7, 42, WALL_ARC),
      wallArcMat: new THREE.MeshLambertMaterial({ color: HAZARD_NORMAL.wallBody, emissive: HAZARD_NORMAL.wallEm, emissiveIntensity: 0.85 }),
      wallRimGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14, 0.09, 5, 42, WALL_ARC),
      wallRimMat: new THREE.MeshBasicMaterial({
        color: HAZARD_NORMAL.wallRim,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      wallGlowMat: mkGlowMat(HAZARD_NORMAL.wallGlow, 0.32),
      wallOutlineGeo: new THREE.TorusGeometry(TUNNEL_R - 0.14, 0.6, 7, 42, WALL_ARC),
      wallOutlineMat: new THREE.MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.8, side: THREE.BackSide, depthWrite: false }),
      haloMat: new THREE.SpriteMaterial({ map: this.darkTex, transparent: true, opacity: 0.7, depthWrite: false }),
      haloSoftMat: new THREE.SpriteMaterial({ map: this.darkTex, transparent: true, opacity: 0.4, depthWrite: false }),
    };
  }

  // ---------------- Ввод ----------------
  private clearInputState = () => {
    this.leftHeld = false;
    this.rightHeld = false;
    this.keyDir = 0;
    this.dragging = false;
    this.pointerId = -1;
  };
  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.curDpr = Math.min(this.curDpr, this.maxDpr);
    this.renderer.setPixelRatio(this.curDpr);
    this.renderer.setSize(w, h, false);
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
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.lastPointerX = e.clientX;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.targetAngle += (dx / Math.max(320, window.innerWidth)) * 6.2;
  };
  private onPointerUp = () => {
    this.dragging = false;
    this.pointerId = -1;
  };

  private bindEvents(canvas: HTMLCanvasElement) {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.clearInputState);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
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
    this.sound.stopDrone();
  }

  revive() {
    this.clearInputState();
    this.light = 72;
    this.combo = 0;
    this.comboT = 0;
    this.setShield(true);
    for (const e of this.entities) {
      if (e.alive && (e.kind === 'shard' || e.kind === 'wall' || e.kind === 'drifter') && e.z > -75) {
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
      const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      tex = paintWallTexture(t.look, t.wall, WALL_LEN / WALL_TILE, aniso);
      this.wallCache.set(t.id, tex);
    }
    return tex;
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
      const a = ((i + 0.5) / count) * Math.PI * 2;
      // не рисуем лучи у пола — там дорожка и перила
      const fromFloor = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
      if (fromFloor < 0.75) continue;
      const bg = new THREE.BoxGeometry(width, width, WALL_LEN);
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
      m.edge.color.setHSL(h, 0.9, 0.34 + 0.32 * k);
    } else {
      m.edge.color.setHex(rc.edge).multiplyScalar(e);
    }
    m.accent.color.setHex(rc.accent).multiplyScalar(0.4 + 0.6 * k);
    m.dim.color.setHex(rc.dim).multiplyScalar(0.55 + 0.45 * k);
    m.halo.color.copy(m.edge.color);
    m.halo.opacity = look.halo * (0.3 + 0.7 * k) * (this.flowT > 0 ? 1.5 : 1);
  }

  /** Яркое ядро в конце тоннеля. */
  private updateCore(k: number, dt: number) {
    const c = this.theme.look.core;
    const pulse = 1 + Math.sin(this.time * 1.3) * 0.05 + (this.flowT > 0 ? 0.1 : 0);
    const gm = this.coreGlow.material as THREE.SpriteMaterial;
    gm.opacity = c.opacity * (0.45 + 0.55 * k);
    this.coreGlow.scale.setScalar(c.size * pulse);
    const rm = this.coreRays.material as THREE.SpriteMaterial;
    rm.opacity = c.rays * (0.4 + 0.6 * k);
    this.coreRays.visible = c.rays > 0;
    rm.rotation += dt * 0.12;
    const nm = this.coreRing.material as THREE.SpriteMaterial;
    nm.opacity = c.ring * (0.5 + 0.5 * k);
    this.coreRing.visible = c.ring > 0;
    this.coreRing.scale.setScalar(c.size * 0.9 * (1 + Math.sin(this.time * 0.9) * 0.03));
  }

  setTheme(id: string) {
    const t = themeById(id);
    const look = t.look;
    this.theme = t;
    (this.scene.background as THREE.Color).set(t.sky);
    this.fog.color.set(t.fog);
    this.fogBase = look.fog;
    if (!this.running) this.fog.density = look.fog;
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
    if (!this.running) this.ambient.intensity = 0.6 * this.ambK;

    // Умеренные частицы: число, размер, прозрачность и палитра
    const dm = this.dust.material as THREE.PointsMaterial;
    dm.size = look.dust.size;
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

    this.rebuildBeams(look.beams.count, look.beams.width);
    this.rebuildRibs();

    this.starMatA?.color.setHex(t.stars);
    this.starMatB?.color.setHex(t.starBright);
    t.planets.forEach((pd, i) => {
      const pl = this.planets[i];
      if (!pl) return;
      pl.position.set(pd.x, pd.y, pd.z);
      const mat = pl.material as THREE.MeshLambertMaterial;
      mat.color.setHex(pd.color);
      mat.emissive.setHex(pd.emissive);
      mat.emissiveIntensity = 0.55 + t.rich * 1.25;
      pl.scale.setScalar(pd.r / (this.planetR[i] || pd.r));
    });
    if (t.nebula) {
      this.nebulae.forEach((n, i) => {
        (n.material as THREE.SpriteMaterial).color.setHex(t.nebula);
        n.scale.setScalar(i === 0 ? 155 : i === 1 ? 102 : 130);
        (n.material as THREE.SpriteMaterial).opacity = 0.12 + t.rich * 0.38;
      });
    }
    this.themeRich = t.rich;
    this.applyHazardPalette(Boolean(t.warm));
    this.applySkin();
  }

  /** Подбирает цвета препятствий так, чтобы они не сливались с обшивкой текущего тоннеля. */
  private applyHazardPalette(cold: boolean) {
    const H = cold ? HAZARD_COLD : HAZARD_NORMAL;
    const A = this.assets;
    A.shardMat.color.setHex(H.shardBody);
    A.shardMat.emissive.setHex(H.shardEm);
    A.shardEdgeMat.color.setHex(H.shardEdge);
    A.shardGlowMat.color.setHex(H.shardGlow);
    A.wallArcMat.color.setHex(H.wallBody);
    A.wallArcMat.emissive.setHex(H.wallEm);
    A.wallRimMat.color.setHex(H.wallRim);
    A.wallGlowMat.color.setHex(H.wallGlow);
    A.drifterCoreMat.color.setHex(H.driftBody);
    A.drifterCoreMat.emissive.setHex(H.driftEm);
    A.drifterLegsMat.color.setHex(H.driftLeg);
    A.drifterGlowMat.color.setHex(H.driftGlow);
    // На холодной палитре подложка плотнее — красный фон не «просвечивает» сквозь объекты
    A.haloMat.opacity = cold ? 0.85 : 0.7;
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

  private setShield(on: boolean) {
    this.shield = on;
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
    for (const p of this.popups) p.sprite.visible = false;
    this.playerAngle = -Math.PI / 2;
    this.targetAngle = -Math.PI / 2;
    this.speed = 23.4;
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
    this.spawnT = 0.48;
    this.firstSpawn = true;
    this.time = 0;
    this.lastT = performance.now();
    this.hudT = 0;
    this.fog.density = this.fogBase;
    this.trail.forEach((t) => t.position.copy(this.player.position));
  }

  private createEntityMesh(kind: Kind): { mesh: THREE.Object3D; radius: number; spinner?: THREE.Object3D } {
    const A = this.assets;
    let radius = PLAYER_R;
    const g = new THREE.Group();

    if (kind === 'wall') {
      const outline = new THREE.Mesh(A.wallOutlineGeo, A.wallOutlineMat);
      const arc = new THREE.Mesh(A.wallArcGeo, A.wallArcMat);
      const rim = new THREE.Mesh(A.wallRimGeo, A.wallRimMat);
      const glow = new THREE.Sprite(A.wallGlowMat);
      glow.scale.setScalar(4.6);
      g.add(outline, arc, rim, glow);
      this.world.add(g);
      return { mesh: g, radius: 0 };
    }

    // Тёмная подложка не вращается и лежит чуть дальше от камеры, чем сам объект
    const spinner = new THREE.Group();
    const hazard = kind === 'shard' || kind === 'drifter';
    const halo = new THREE.Sprite(hazard ? A.haloMat : A.haloSoftMat);
    halo.scale.setScalar(hazard ? 3.0 : 1.9);
    halo.position.z = -0.7;
    g.add(halo, spinner);

    if (kind === 'orb') {
      // Классический огонёк-светлячок: чистое яркое ядро + тёплый золотой ореол
      spinner.add(new THREE.Mesh(A.orbCoreGeo, A.orbCoreMat));
      const orbHalo = new THREE.Sprite(A.orbGlowMat);
      orbHalo.scale.setScalar(1.85);
      spinner.add(orbHalo);
    } else if (kind === 'shard') {
      const body = new THREE.Mesh(A.shardGeo, A.shardMat);
      const edges = new THREE.LineSegments(A.shardEdgesGeo, A.shardEdgeMat);
      const glow = new THREE.Sprite(A.shardGlowMat);
      glow.scale.setScalar(2.6);
      spinner.add(body, edges, glow);
      spinner.scale.setScalar(1.12);
      radius = PLAYER_R + 0.12;
    } else if (kind === 'flash') {
      const core = new THREE.Mesh(A.flashGeo, A.flashMat);
      const glow = new THREE.Sprite(A.flashGlowMat);
      glow.scale.setScalar(2.6);
      spinner.add(core, glow);
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
    } else if (kind === 'drifter') {
      const core = new THREE.Mesh(A.drifterCoreGeo, A.drifterCoreMat);
      const legs = new THREE.LineSegments(A.drifterLegsGeo, A.drifterLegsMat);
      const glow = new THREE.Sprite(A.drifterGlowMat);
      glow.scale.setScalar(2.3);
      spinner.add(core, legs, glow);
      radius = PLAYER_R + 0.05;
    } else {
      const cell = new THREE.Mesh(A.overCellGeo, A.overCellMat);
      const cap = new THREE.Mesh(A.overCapGeo, A.overCapMat);
      cap.position.y = 0.36;
      const ring = new THREE.Mesh(A.overRingGeo, A.overRingMat);
      ring.rotation.x = Math.PI / 2;
      const glow = new THREE.Sprite(A.overGlowMat);
      glow.scale.setScalar(2.4);
      spinner.add(cell, cap, ring, glow);
    }

    this.world.add(g);
    return { mesh: g, radius, spinner };
  }

  /** 0..1 — насколько мы приблизились к максимальной скорости (0 — старт, 1 — потолок). */
  private speedK() {
    return Math.min(1, Math.max(0, (this.speed - 23.4) / 42.3));
  }

  private makeEntity(kind: Kind, angle: number, z: number, dir = 1): Entity {
    // На высокой скорости ряды волны растягиваются по глубине: между преградами больше места для манёвра
    if (z <= SPAWN_Z) {
      const sk = this.speedK();
      const stretch = 1 + 0.55 * sk * sk * (3 - 2 * sk);
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
      const { mesh, radius, spinner } = this.createEntityMesh(kind);
      e = { mesh, kind, angle, z, alive: true, spin: Math.random() * 6.28, radius, missed: false, dir, spinner };
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
    if (b < 0.42) return 'magnet';
    if (b < 0.78) return 'flash';
    return 'overcharge';
  }

  /** С шансом ~24% добавляет бафф в волну препятствий, чтобы баффы встречались регулярно. */
  private maybeSpawnBonusBuff(angle: number, z: number, chance = 0.24) {
    if (Math.random() < chance * 0.94) {
      this.makeEntity(this.rollBuffKind(), angle, z);
    }
  }

  private spawnPattern() {
    const d = this.difficulty();
    const base = SPAWN_Z;
    const a0 = Math.random() * Math.PI * 2;
    const dark = Math.max(0, (this.score - 9000) / 14000);
    const gatesAllowed = this.distance > 160;

    if (this.firstSpawn) {
      this.firstSpawn = false;
      const fb = -42;
      const fa = this.playerAngle + (Math.random() - 0.5) * 0.22;
      for (let i = 0; i < 6; i++) this.makeEntity('orb', fa, fb - i * 3.0);
      this.makeEntity('shard', fa + 0.65, fb - 19);
      this.makeEntity('shard', fa - 0.65, fb - 19);
      this.spawnT = 1.2;
      return;
    }

    this.patternMinZ = base;
    this.spawnPatternInner(d, base, a0, dark, gatesAllowed);
    // Паузы между волнами чуть длиннее — на ~10% легче
    this.spawnT *= 1.1;
    // Просвет между волнами считаем в метрах, а не только в секундах: чем ближе к максимальной
    // скорости, тем больше свободного пространства между концом одной волны и началом следующей.
    const sk = this.speedK();
    const clearM = Math.max(0, sk - 0.2) / 0.8 * 44;
    if (clearM > 0) {
      const waveLen = base - this.patternMinZ;
      this.spawnT = Math.max(this.spawnT, (waveLen + clearM) / Math.max(20, this.speed));
    }
  }

  private spawnPatternInner(d: number, base: number, a0: number, dark: number, gatesAllowed: boolean) {
    const r = Math.random();
    if (r < 0.13) {
      // Извилистая дорожка светлячков под охраной боковых осколков
      const n = 5 + Math.floor(Math.random() * 4);
      const twist = (Math.random() < 0.5 ? 1 : -1) * (0.24 + d * 0.12);
      for (let i = 0; i < n; i++) {
        const ang = a0 + twist * i;
        this.makeEntity('orb', ang, base - i * 3.2);
        if (i % 2 === 1) {
          this.makeEntity('shard', ang + (i % 4 === 1 ? 0.58 : -0.58), base - i * 3.2);
        }
      }
      this.maybeSpawnBonusBuff(a0 + twist * n, base - n * 3.2 - 3, 0.28);
      this.spawnT = (1.15 + n * 0.1) * (dark > 0 ? 0.8 : 1);
    } else if (r < 0.37) {
      // Кольцо осколков с узким проходом (и вторым каскадным кольцом на высокой сложности)
      const n = Math.min(d > 0.55 ? 11 : 9, 6 + Math.floor(d * 4 + Math.random() * 1.5));
      const step = (Math.PI * 2) / (n + 2);
      const gap = Math.floor(Math.random() * (n + 2));
      for (let i = 0; i < n + 2; i++) {
        if (i === gap || i === (gap + 1) % (n + 2)) continue;
        this.makeEntity('shard', a0 + i * step, base);
      }
      const gapCenter = a0 + gap * step + step * 0.5;
      this.makeEntity('orb', gapCenter, base - 3.5);
      this.maybeSpawnBonusBuff(gapCenter + step, base - 7, 0.25);

      if (d > 0.32 && Math.random() < 0.55) {
        const gap2 = (gap + 2 + Math.floor(Math.random() * 3)) % (n + 2);
        for (let i = 0; i < n + 2; i++) {
          if (i === gap2 || i === (gap2 + 1) % (n + 2)) continue;
          this.makeEntity('shard', a0 + i * step, base - 15);
        }
        this.makeEntity('orb', a0 + gap2 * step + step * 0.5, base - 18.5);
        this.spawnT = Math.max(0.95, 1.38 - d * 0.32);
      } else {
        this.spawnT = Math.max(0.72, 1.12 - d * 0.38);
      }
    } else if (r < 0.57) {
      // Минное поле: плотный эшелон осколков (часто парами) + светлячки и баффы
      const n = 6 + Math.floor(d * 4);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const z = base - i * 7.2;
        this.makeEntity('shard', a, z);
        if (Math.random() < 0.4 + d * 0.3) {
          this.makeEntity('shard', a + Math.PI * (0.55 + Math.random() * 0.5), z);
        }
        if (Math.random() < 0.65) {
          this.makeEntity('orb', a + (Math.random() < 0.5 ? 0.52 : -0.52), z - 2.6);
        }
      }
      this.maybeSpawnBonusBuff(a0 + Math.PI * 0.5, base - n * 3.6, 0.26);
      this.spawnT = Math.max(1.05, 1.38 - d * 0.24);
    } else if (r < 0.74 || (r < 0.84 && !gatesAllowed)) {
      // Двойная спираль осколков с коридором светлячков
      const n = 8 + Math.floor(d * 3);
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const z = base - i * 4.5;
        const ang = a0 + dir * i * 0.35;
        this.makeEntity('shard', ang, z);
        if (i % 2 === 0 || d > 0.45) {
          this.makeEntity('shard', ang + Math.PI, z);
        }
        this.makeEntity('orb', ang + dir * Math.PI * 0.5, z);
      }
      this.maybeSpawnBonusBuff(a0 + dir * n * 0.35 + dir * Math.PI * 0.5, base - n * 4.5 - 3, 0.25);
      this.spawnT = Math.max(1.05, 1.32 - d * 0.2);
    } else if (r < 0.84 && gatesAllowed) {
      // Вращающиеся лазерные стенки-шлюзы
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.makeEntity('wall', a0, base, dir);
      this.makeEntity('wall', a0 + Math.PI * 0.9, base - 16, -dir);
      if (d > 0.62 && Math.random() < 0.5) {
        this.makeEntity('wall', a0 + Math.PI * 0.2, base - 32, dir);
      }
      for (let i = 0; i < 3; i++) this.makeEntity('orb', a0 + Math.PI + (i - 1) * 0.34, base - 5 - i * 2.6);
      this.maybeSpawnBonusBuff(a0 + Math.PI, base - 23, 0.32);
      this.spawnT = Math.max(2.1, 2.55 - d * 0.35);
    } else if (r < 0.925) {
      // Охотничья стая самонаводящихся дрейфунов + осколки прикрытия
      const nd = 2 + Math.floor(d * 2.5);
      for (let i = 0; i < nd; i++) {
        const da = a0 + i * 1.25;
        this.makeEntity('drifter', da, base - i * 10.5);
        if (i % 2 === 1) this.makeEntity('shard', da + Math.PI * 0.65, base - i * 10.5 - 4);
      }
      for (let i = 0; i < 4; i++) this.makeEntity('orb', a0 + Math.PI + i * 0.26, base - 3 - i * 3.0);
      this.maybeSpawnBonusBuff(a0 + Math.PI + 0.5, base - nd * 10.5 - 2, 0.28);
      this.spawnT = Math.max(1.4, 1.85 - d * 0.28);
    } else {
      // Выделенная волна баффа под охраной осколков (7.5% шанс + короткий кулдаун)
      const buffKind = this.rollBuffKind();
      this.makeEntity(buffKind, a0, base - 4);
      this.makeEntity('shard', a0 + 0.56, base);
      this.makeEntity('shard', a0 - 0.56, base);
      if (d > 0.4) this.makeEntity('drifter', a0 + Math.PI, base - 9);
      for (let i = 0; i < 3; i++) this.makeEntity('orb', a0, base - 9 - i * 3.0);
      this.spawnT = 1.15;
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

  private showPopup(text: string, color: number, at: THREE.Vector3, big = false) {
    let slot = this.popups.find((p) => p.life <= 0);
    if (!slot) slot = this.popups[Math.floor(Math.random() * this.popups.length)];
    const c = slot.ctx;
    const hex = '#' + color.toString(16).padStart(6, '0');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, POP_W, POP_H);
    c.globalCompositeOperation = 'source-over';

    const fs = big ? 66 : 48;
    c.font = `900 ${fs}px Unbounded, Manrope, "Segoe UI", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const tw = Math.min(POP_W - 88, c.measureText(text).width);
    const pw = tw + 52;
    const ph = big ? 102 : 78;
    const px = (POP_W - pw) / 2;
    const py = (POP_H - ph) / 2;

    c.fillStyle = 'rgba(6,8,22,0.92)';
    roundRectPath(c, px, py, pw, ph, 20);
    c.fill();

    c.strokeStyle = hex;
    c.lineWidth = 4;
    roundRectPath(c, px, py, pw, ph, 20);
    c.stroke();
    c.fillStyle = hex;
    c.fillRect(px + 12, py + 12, 5, ph - 24);

    c.fillStyle = '#ffffff';
    c.fillText(text, POP_W / 2, POP_H / 2 + (big ? 5 : 3));

    slot.tex.needsUpdate = true;
    slot.w = big ? 4.4 : 3.35;
    slot.h = big ? 1.22 : 0.92;
    slot.sprite.scale.set(slot.w, slot.h, 1);
    slot.sprite.visible = true;
    slot.sprite.position.set(at.x + (Math.random() - 0.5) * 0.7, at.y + 1.25, at.z - 2.6);
    slot.maxLife = slot.life = big ? 1.2 : 0.9;
  }

  private setShieldOpacity(k: number) {
    for (const m of this.shieldMats) (m.mat as THREE.MeshBasicMaterial).opacity = m.base * k;
  }

  private spawnEmber() {
    const pPos = this.player.position;
    for (const p of this.particles) {
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      p.sprite.position.set(pPos.x + (Math.random() - 0.5) * 0.28, pPos.y + (Math.random() - 0.5) * 0.28, pPos.z + 0.2);
      (p.sprite.material as THREE.SpriteMaterial).color.setHex(this.skin.trail);
      (p.sprite.material as THREE.SpriteMaterial).opacity = 0.85;
      p.vel.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 5 + Math.random() * 3);
      p.maxLife = p.life = 0.34 + Math.random() * 0.22;
      p.sprite.scale.setScalar(0.2 + Math.random() * 0.18);
      return;
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
    this.fog.density = 0.024;
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

  private pushHud() {
    const radar: RadarDot[] = [];
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      const dist = -e.z;
      if (dist < 2 || dist > RADAR_RANGE) continue;
      if (e.kind === 'wall') {
        const c = wrapAngle(this.effAngleOf(e) - this.playerAngle);
        for (const off of [-WALL_ARC / 2, 0, WALL_ARC / 2]) {
          const rel = wrapAngle(c + off);
          if (Math.abs(rel) > 1.15) continue;
          radar.push({ x: 0.5 + (rel / 1.15) * 0.5, y: dist / RADAR_RANGE, k: 0 });
          if (radar.length >= 28) break;
        }
        if (radar.length >= 28) break;
        continue;
      }
      const rel = wrapAngle(this.effAngleOf(e) - this.playerAngle);
      if (Math.abs(rel) > 1.15) continue;
      const isBuff = e.kind === 'flash' || e.kind === 'magnet' || e.kind === 'overcharge';
      radar.push({
        x: 0.5 + (rel / 1.15) * 0.5,
        y: dist / RADAR_RANGE,
        k: e.kind === 'orb' ? 1 : isBuff ? 2 : 0,
      });
      if (radar.length >= 28) break;
    }
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
      danger: 1 - Math.max(0, this.light) / MAX_LIGHT,
      flow: Math.max(0, Math.min(1, this.flowT / FLOW_TIME)),
      powerups: this.powerups,
      nearMiss: this.nearMiss,
      radar,
    });
  }

  private update(dt: number) {
    this.time += dt;

    // Автоматический контроль плавности: если средний FPS ниже ~48, мягко снижаем pixelRatio
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsFrames >= 45) {
      const avgDt = this.fpsAccum / this.fpsFrames;
      if (avgDt > 0.0215 && this.curDpr > 1.05) {
        this.curDpr = Math.max(1.0, +(this.curDpr - 0.25).toFixed(2));
        this.renderer.setPixelRatio(this.curDpr);
      }
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    // --- Управление: мир вращается вокруг игрока ---
    if (this.keyDir !== 0) this.targetAngle += this.keyDir * 3.85 * dt;
    const diff = wrapAngle(this.targetAngle - this.playerAngle);
    const lerp = Math.min(1, dt * 15);
    this.playerAngle += diff * lerp;
    this.targetAngle = this.playerAngle + diff * (1 - lerp);
    this.world.rotation.z = -Math.PI / 2 - this.playerAngle;
    this.player.rotation.z = -diff * 0.35;

    // --- Движение (~20% интенсивнее) ---
    const d = this.difficulty();
    const dark = Math.max(0, (this.score - 9000) / 12500);
    this.speed = (23.4 + d * 42.3) * (this.overchargeT > 0 ? 1.14 : 1);
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

    // Стартовое затемнение быстрее (~3.85%/с вместо 3.1%/с, +24%)
    // Стартовая скорость угасания прежняя, но её рост со временем теперь очень плавный
    // (раньше +3.9 за забег и до +4.0 после 9000 очков, потолок 14/с; теперь потолок ≈ 6.3/с).
    let drain = (3.5 + d * 1.1 + Math.min(dark, 1.5) * 1.2) * this.skin.drainMult;
    if (this.overchargeT > 0) drain = -3.95;
    drain = Math.min(drain, 6.3 * this.skin.drainMult);
    this.light -= drain * dt;
    this.light = Math.min(MAX_LIGHT, this.light);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo > 0) {
        this.combo = 0;
        this.comboT = 0;
      }
    }
    if (this.magnetT > 0) this.magnetT = Math.max(0, this.magnetT - dt);
    if (this.overchargeT > 0) this.overchargeT = Math.max(0, this.overchargeT - dt);

    // --- Кольца, портальные арки и линии скорости ---
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.position.z += move;
      if (ring.position.z > DESPAWN_Z) ring.position.z -= RING_COUNT * RING_GAP;
    }
    const k = Math.max(0, this.light) / MAX_LIGHT;
    this.updateRibLook(k);
    this.updateCore(k, dt);

    const spos = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = spos.array as Float32Array;
    const sMove = move * (1 + d * 1.4) * 1.15;
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += sMove;
      if (arr[i] > 14) arr[i] -= 270;
    }
    spos.needsUpdate = true;

    const dpos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const darr = dpos.array as Float32Array;
    for (let i = 2; i < darr.length; i += 3) {
      darr[i] += move;
      if (darr[i] > 12) darr[i] -= 272;
    }
    dpos.needsUpdate = true;
    this.dust.rotation.z += dt * 0.05;

    this.streakMat.opacity = (0.03 + d * 0.24 + this.flashFx * 0.25 + (this.flowT > 0 ? 0.18 : 0)) * this.theme.look.streak.gain;
    this.strutOuter.opacity = 0.14 + (this.flowT > 0 ? 0.16 : 0) + d * 0.08 + this.themeRich * 0.08;

    this.scrollZ += move;
    if (this.wallMat.map) this.wallMat.map.offset.y = -(this.scrollZ / WALL_TILE) % 1;
    if (this.runwayMat.map) this.runwayMat.map.offset.y = -this.scrollZ / 21;
    this.beamMat.opacity = 0.14 + d * 0.18 + k * 0.1;
    this.strutMat.opacity = 0.15 + k * 0.2;
    this.railMat.opacity = 0.12 + k * 0.24;
    this.runwayMat.opacity = 0.22 + k * 0.32;
    this.space.rotation.z += dt * 0.012;
    for (let i = 0; i < this.planets.length; i++) this.planets[i].rotation.y += dt * 0.08;

    const sv = 0.1 + k * 0.8;
    if (this.starMatA) this.starMatA.opacity = 0.72 * sv;
    if (this.starMatB) this.starMatB.opacity = 0.34 * sv;
    for (let i = 0; i < this.nebulae.length; i++) (this.nebulae[i].material as THREE.SpriteMaterial).opacity = 0.08 + k * 0.24;
    for (let i = 0; i < this.planets.length; i++) {
      (this.planets[i].material as THREE.MeshLambertMaterial).emissiveIntensity = 0.35 + k * 1.45;
    }

    this.spawnT -= dt;
    if (this.spawnT <= 0) this.spawnPattern();

    // --- Сущности (без аллокаций векторов и массивов) ---
    const pPos = this.tmpV.copy(this.player.position);
    let culled = false;
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
      if (this.magnetT > 0 && e.kind === 'orb' && e.z > -48) {
        e.angle += wrapAngle(this.playerAngle - e.angle) * Math.min(1, dt * 6.8);
      }
      const ea = this.effAngleOf(e);
      this.placeEntity(e, ea);

      if (e.kind === 'orb') {
        // Огонёк мягко дышит по яркости/размеру
        e.mesh.scale.setScalar(1 + Math.sin(e.spin * 3.2) * 0.12);
      } else if (e.kind === 'wall') {
        e.mesh.rotation.z = e.angle + e.spin * WALL_SPIN - WALL_ARC / 2;
      } else if (e.kind === 'drifter') {
        const da = wrapAngle(this.playerAngle - e.angle);
        const homing = e.z > -48 ? 1.04 : 0.44;
        e.angle += Math.max(-0.68, Math.min(0.68, da)) * dt * homing;
        const sp = e.spinner ?? e.mesh;
        sp.rotation.z = Math.sin(e.spin * 3) * 0.4;
        sp.rotation.y += dt * 1.5;
      } else if (e.kind === 'overcharge') {
        (e.spinner ?? e.mesh).rotation.set(0, e.spin * 1.6, 0);
      } else {
        (e.spinner ?? e.mesh).rotation.set(e.spin, e.spin * (e.kind === 'shard' ? 0.7 : 1.3), 0);
      }

      const dz = Math.abs(e.z);
      if (dz < 1.35) {
        const da = Math.abs(wrapAngle(ea - this.playerAngle));
        const hit = e.kind === 'wall' ? da < WALL_ARC / 2 - 0.08 : da < (e.kind === 'orb' ? 0.27 : 0.28);
        if (hit) {
          this.kill(e);
          culled = true;
          if (e.kind === 'orb') {
            this.combo++;
            this.comboMax = Math.max(this.comboMax, this.combo);
            this.comboT = COMBO_HOLD;
            this.orbs++;
            this.light = Math.min(MAX_LIGHT, this.light + 12 * this.fx.orbLight * this.skin.orbLightMult);
            const mult = Math.min(this.combo, 10) * (this.flowT > 0 ? 1.5 : 1);
            const gain = 10 * mult * this.fx.scoreMult;
            this.score += gain;
            this.emit(pPos, 0xffe08a, 8 + Math.min(mult, 7));
            this.sound.pickup(this.combo, this.combo >= 10);
            if (mult === 5 || mult === 10) this.showPopup(`×${mult} КОМБО`, 0xffd166, pPos, mult >= 10);
          } else if (e.kind === 'shard' || e.kind === 'wall' || e.kind === 'drifter') {
            if (this.shield) {
              this.setShield(false);
              this.shieldBreakT = 0.35;
              this.emit(pPos, 0x6ef7d8, 20, 1.6);
              this.showPopup('ЩИТ', 0x6ef7d8, pPos);
              this.sound.powerup();
            } else if (this.wardenCharges > 0) {
              // Бафф «Пепельный оберег»: первый удар не гасит свет и не сбрасывает комбо
              this.wardenCharges--;
              this.shake = 0.45;
              this.emit(pPos, 0xffd166, 20, 1.5);
              this.showPopup('ОБЕРЕГ', 0xffd166, pPos);
              this.sound.powerup();
            } else {
              this.light -= 26;
              this.shake = 1;
              this.emit(pPos, this.theme.warm ? 0xbcd8ff : 0xff2f74, 18, 1.5);
              if (this.absorb) {
                this.absorb = false;
                this.showPopup('ПОКРОВ', 0xc3aaff, pPos);
              } else {
                this.combo = 0;
                this.comboT = 0;
              }
              this.sound.hit();
            }
          } else if (e.kind === 'flash') {
            let n = 0;
            for (let j = 0; j < this.entities.length; j++) {
              const o = this.entities[j];
              if (o.alive && (o.kind === 'shard' || o.kind === 'drifter') && o.z > -95) {
                o.mesh.getWorldPosition(this.tmpV2);
                this.emit(this.tmpV2, 0x6ef7d8, 3, 0.9);
                this.kill(o);
                n++;
              }
            }
            culled = true;
            this.powerups++;
            this.score += 23 * n + 56;
            this.light = Math.min(MAX_LIGHT, this.light + 17);
            this.flashFx = 1;
            this.emit(pPos, 0x6ef7d8, 28, 2.1);
            this.showPopup(`ВСПЫШКА +${23 * n + 56}`, 0x6ef7d8, pPos);
            this.sound.flash();
          } else if (e.kind === 'magnet') {
            this.magnetT = this.magnetDur;
            this.powerups++;
            this.score += 56;
            this.emit(pPos, 0xc3aaff, 18, 1.6);
            this.showPopup('МАГНИТ', 0xc3aaff, pPos);
            this.sound.powerup();
          } else if (e.kind === 'overcharge') {
            this.overchargeT = 4.7;
            this.powerups++;
            this.score += 56;
            this.emit(pPos, 0x7dff6a, 18, 1.5);
            this.showPopup('ПЕРЕЗАРЯД', 0x7dff6a, pPos);
            this.sound.charge();
          }
        } else if (
          !e.missed &&
          ((e.kind === 'shard' && da < 0.64) || (e.kind === 'drifter' && da < 0.64) || (e.kind === 'wall' && da < WALL_ARC / 2 + 0.26))
        ) {
          e.missed = true;
          this.nearMiss++;
          this.score += (25 + this.combo * 2) * this.fx.scoreMult;
          this.flowStack++;
          this.flowStackT = FLOW_STACK;
          if (this.flowStack >= 3 && this.flowT <= 0.2) {
            this.flowStack = 0;
            this.flowT = FLOW_TIME;
            this.flowMax = Math.max(this.flowMax, 1);
            this.showPopup('ПОТОК ×1.5', 0x6ef7d8, pPos, true);
            this.emit(pPos, 0x6ef7d8, 22, 1.7);
            this.flashFx = 0.6;
            this.sound.flow();
          }
          this.light = Math.min(MAX_LIGHT, this.light + 1.6);
          this.emit(pPos, 0xffffff, 5, 0.7);
          this.showPopup('ВПРИТИРКУ +25', 0xffe9b8, pPos);
          this.sound.nearMiss();
        } else if (e.z < -1.35 && !e.missed) {
          e.missed = true;
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
    for (let i = 0; i < this.popups.length; i++) {
      const p = this.popups[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.maxLife;
      const age = p.maxLife - p.life;
      const punch = Math.min(1, age / 0.11);
      p.sprite.position.y += dt * 1.15;
      p.sprite.position.z += move * 0.55;
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, t * 3.2);
      const sc = 0.82 + 0.18 * punch;
      p.sprite.scale.set(p.w * sc, p.h * sc, 1);
    }

    // --- Свет, анимация текстурированной искры и камеры ---
    this.fog.density = this.fogBase + (1 - k) * (1 - k) * 0.046;
    this.ambient.intensity = (0.3 + k * 0.55) * this.ambK;
    this.playerLight.intensity = (12 + k * 52 + this.flashFx * 90) * this.lightK;
    const flicker = k < 0.26 ? 0.58 + Math.abs(Math.sin(this.time * 10)) * 0.42 : 1;

    this.sparkRig.update(dt, this.time, k * flicker, d);

    const glowMat = this.playerGlow.material as THREE.SpriteMaterial;
    this.playerGlow.scale.setScalar(2.1 + k * 1.65 + Math.sin(this.time * 7) * 0.13 + this.flashFx * 3.0);
    glowMat.opacity = (0.45 + k * 0.55) * flicker;
    glowMat.color.setHex(this.magnetT > 0 ? 0xd9c6ff : 0xffffff);
    glowMat.rotation = this.time * 0.25;

    (this.auraMesh.material as THREE.MeshBasicMaterial).opacity = this.combo >= 3 ? Math.min(0.85, this.combo * 0.09) : 0;
    this.auraMesh.rotation.z += dt * 3;
    this.auraMesh.scale.setScalar(1 + Math.sin(this.time * 6) * 0.08 + this.comboT * 0.2);

    // Щит
    if (this.shield) {
      this.shieldGroup.visible = true;
      this.shieldGroup.scale.setScalar(1 + Math.sin(this.time * 3.2) * 0.045);
      this.shieldGroup.rotation.y += dt * 0.9;
      const gA = this.shieldGroup.children[2] as THREE.Mesh;
      const gB = this.shieldGroup.children[3] as THREE.Mesh;
      gA.rotation.x += dt * 1.7;
      gA.rotation.z += dt * 0.6;
      gB.rotation.y += dt * 1.4;
      this.setShieldOpacity(1);
    } else if (this.shieldBreakT > 0) {
      this.shieldBreakT -= dt;
      const bk = Math.max(0, this.shieldBreakT / 0.35);
      this.shieldGroup.visible = true;
      this.shieldGroup.scale.setScalar(1 + (1 - bk) * 1.7);
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
      this.magnetGroup.scale.setScalar(0.5 + 0.5 * ease);
      for (let i = 0; i < this.magnetArcs.length; i++) {
        const a = this.magnetArcs[i];
        (a.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.abs(Math.sin(this.time * 4.5 + i * 1.7)) * 0.5;
        a.rotation.z += dt * (1.2 + i * 0.5);
      }
      this.magnetSpawnT -= dt;
      if (this.magnetSpawnT <= 0) {
        this.magnetSpawnT = 0.14;
        this.spawnAttractionParticle();
      }
    } else {
      this.magnetGroup.visible = false;
      this.magnetPop = 0;
    }

    if (this.skin.shape === 'flame' || this.skin.shape === 'star') {
      this.emberT -= dt;
      if (this.emberT <= 0) {
        this.emberT = this.skin.shape === 'flame' ? 0.14 : 0.24;
        this.spawnEmber();
      }
    }

    this.flashFx = Math.max(0, this.flashFx - dt * 2.2);

    const trailLerp = Math.min(1, dt * 16);
    for (let i = this.trail.length - 1; i > 0; i--) {
      this.trail[i].position.lerp(this.trail[i - 1].position, trailLerp);
      this.trail[i].position.z += move * 0.4;
      if (this.trail[i].position.z > 9) this.trail[i].position.copy(this.trail[0].position);
    }
    this.trail[0].position.copy(this.player.position).setZ(0.25);

    this.shake = Math.max(0, this.shake - dt * 3.1);
    const amp = this.shake * 0.4 + (k < 0.18 ? 0.05 : 0);
    this.camera.position.set((Math.random() - 0.5) * amp, 0.8 + (Math.random() - 0.5) * amp, 7);
    this.camera.lookAt(this.camTarget);

    const targetFov = 75 + d * 11 + this.flashFx * 6 + (this.flowT > 0 ? 4 : 0);
    const nextFov = this.camera.fov + (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    if (Math.abs(nextFov - this.camera.fov) > 0.03) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.sound.setIntensity(d, 1 - k);

    this.hudT += dt;
    if (this.hudT > 0.1) {
      this.hudT = 0;
      this.pushHud();
    }

    if (this.light <= 0) {
      this.light = 0;
      this.gameOver();
    }
  }

  private idleUpdate(dt: number) {
    const move = 7 * dt;
    this.time += dt;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.position.z += move;
      if (ring.position.z > DESPAWN_Z) ring.position.z -= RING_COUNT * RING_GAP;
    }
    this.updateRibLook(1);
    this.updateCore(1, dt);

    const spos = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = spos.array as Float32Array;
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += move * 2.1;
      if (arr[i] > 14) arr[i] -= 270;
    }
    spos.needsUpdate = true;

    const dpos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const di = dpos.array as Float32Array;
    for (let i = 2; i < di.length; i += 3) {
      di[i] += move;
      if (di[i] > 12) di[i] -= 272;
    }
    dpos.needsUpdate = true;

    this.streakMat.opacity = 0.08;
    this.world.rotation.z += dt * 0.14;
    this.scrollZ += move;
    if (this.wallMat.map) this.wallMat.map.offset.y = -(this.scrollZ / WALL_TILE) % 1;
    if (this.runwayMat.map) this.runwayMat.map.offset.y = -this.scrollZ / 3;
    this.beamMat.opacity = 0.26;
    this.railMat.opacity = 0.16;
    this.runwayMat.opacity = 0.34;
    this.space.rotation.z += dt * 0.02;
    for (let i = 0; i < this.planets.length; i++) this.planets[i].rotation.y += dt * 0.06;
    if (this.starMatA) this.starMatA.opacity = 0.85;
    if (this.starMatB) this.starMatB.opacity = 0.5;
    for (let i = 0; i < this.nebulae.length; i++) (this.nebulae[i].material as THREE.SpriteMaterial).opacity = 0.42;

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
    for (let i = 0; i < this.trail.length; i++) this.trail[i].position.copy(this.player.position);
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
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.running && !this.paused && !this.over) this.update(dt);
    else if (!this.running) this.idleUpdate(dt);
    this.renderer.render(this.scene, this.camera);
  };
}
