// 3D-осмотр скинов и тоннелей для Магазина. Отдельная лёгкая сцена со своим рендерером:
// строится из тех же данных (Theme / TunnelLook / Skin), что и сама игра, поэтому то, что
// игрок видит в магазине, — ровно то, что он получит на трассе.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { themeById, type Theme } from './economy';
import { makeGlowTexture, makeRunwayTexture, makeStarTexture } from './Engine';
import { buildSparkRig, type SparkRig } from './sparkSkins';
import { skinById } from './state';
import { createTunnelFx, type TunnelFx } from './tunnelFx';
import {
  buildRibGeos,
  createRibMats,
  createSkyDome,
  beamAngle,
  disposeRibGeos,
  makeRaysTexture,
  makeThinRingTexture,
  mergeSimpleGeometries,
  paintWallTexture,
  ribPieces,
  WALL_TILE,
  type RibGeos,
  type RibMats,
  type SkyDome,
} from './tunnels';

const TUNNEL_R = 5;
const RING_GAP = 8;

interface Disposable {
  dispose: () => void;
}

function computeViewerDpr(w: number, h: number): number {
  const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
  const isTouch = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
  if (!isTouch) return rawDpr;
  const budgetDpr = Math.sqrt(1_800_000 / Math.max(1, w * h));
  return Math.max(1.15, Math.min(rawDpr, +budgetDpr.toFixed(2)));
}

function fitRenderer(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, host: HTMLElement) {
  const w = Math.max(2, host.clientWidth);
  const h = Math.max(2, host.clientHeight);
  renderer.setPixelRatio(computeViewerDpr(w, h));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function makeStars(count: number, color: number, size: number, opacity: number, rMin: number, rSpan: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * rSpan;
    const a = Math.random() * Math.PI * 2;
    let b = Math.acos(2 * Math.random() - 1);
    if (Math.sin(b) < 0.46) {
      b = b < Math.PI / 2 ? 0.46 + Math.random() * 0.45 : Math.PI - (0.46 + Math.random() * 0.45);
    }
    pos[i * 3] = r * Math.sin(b) * Math.cos(a);
    pos[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
    pos[i * 3 + 2] = r * Math.cos(b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: makeStarTexture(),
    size,
    sizeAttenuation: false,
    color,
    transparent: true,
    opacity,
    fog: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -15;
  return pts;
}

function disposePoints(p: THREE.Points) {
  p.geometry.dispose();
  const m = p.material as THREE.PointsMaterial;
  m.map?.dispose();
  m.dispose();
}

// ======================================================================
// Скин: «витрина» с пьедесталом из света
// ======================================================================
export class SkinViewer3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  private controls: OrbitControls;
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private ro: ResizeObserver;
  private disposed = false;

  private glowTex = makeGlowTexture();
  private stage = new THREE.Group();
  private rigHolder = new THREE.Group();
  private rig: SparkRig | null = null;
  private halo: THREE.Sprite;
  private backdrop: THREE.Sprite;
  private spotMesh: THREE.Mesh;
  private poolMesh: THREE.Mesh;
  private motes: THREE.Points;
  private moteSeeds: Float32Array;
  private stars: THREE.Points[] = [];
  private toDispose: Disposable[] = [];
  private tmp = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, skinId: string) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x04030c);

    // Камера осмотра искр отдалена на 30% для комфортного обзора всей модели и короны
    this.camera.position.set(0, 0.91, 11.44);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 5.46;
    this.controls.maxDistance = 18.2;
    this.controls.rotateSpeed = 0.8;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.target.set(0, 0.05, 0);

    this.scene.add(this.stage);
    this.stage.add(this.rigHolder);
    this.rigHolder.scale.setScalar(1.5);

    this.stars.push(makeStars(420, 0xc9dbff, 2.0, 0.7, 40, 60), makeStars(120, 0xfff0d0, 4.5, 0.4, 45, 55));
    for (const s of this.stars) this.scene.add(s);

    const mkSprite = (opacity: number) =>
      new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
      );
    this.backdrop = mkSprite(0.17);
    this.backdrop.scale.setScalar(26);
    this.scene.add(this.backdrop);

    this.halo = mkSprite(0.62);
    this.rigHolder.add(this.halo);

    // Пьедестал: широкий световой бассейн и яркое пятно (без колец)
    this.poolMesh = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 48),
      new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.poolMesh.rotation.x = -Math.PI / 2;
    this.poolMesh.position.y = -1.55;
    this.stage.add(this.poolMesh);
    this.toDispose.push(this.poolMesh.geometry, this.poolMesh.material as THREE.Material);

    // Вместо колец-платформы — яркое отсвечивающее пятно света на «полу» (мягкая сердцевина поверх широкого бассейна)
    this.spotMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 48),
      new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.spotMesh.rotation.x = -Math.PI / 2;
    this.spotMesh.position.y = -1.54;
    this.stage.add(this.spotMesh);
    this.toDispose.push(this.spotMesh.geometry, this.spotMesh.material as THREE.Material);

    // Лёгкие искры, поднимающиеся над пьедесталом
    const N = 70;
    this.moteSeeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.moteSeeds[i * 3] = Math.random() * Math.PI * 2; // угол
      this.moteSeeds[i * 3 + 1] = 0.7 + Math.random() * 1.5; // радиус
      this.moteSeeds[i * 3 + 2] = Math.random(); // фаза высоты
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const moteTex = makeStarTexture();
    this.motes = new THREE.Points(
      mg,
      new THREE.PointsMaterial({ map: moteTex, size: 0.09, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.stage.add(this.motes);
    this.toDispose.push(mg, this.motes.material as THREE.Material, moteTex);

    this.setSkin(skinId);

    const host = canvas.parentElement ?? canvas;
    this.ro = new ResizeObserver(() => fitRenderer(this.renderer, this.camera, host));
    this.ro.observe(host);
    fitRenderer(this.renderer, this.camera, host);
    this.loop();
  }

  setSkin(id: string) {
    const skin = skinById(id);
    if (this.rig) {
      this.rigHolder.remove(this.rig.group);
      this.rig.dispose();
    }
    this.rig = buildSparkRig(skin);
    this.rigHolder.add(this.rig.group);

    const hm = this.halo.material as THREE.SpriteMaterial;
    hm.map = this.rig.coronaTex;
    hm.needsUpdate = true;
    this.halo.scale.setScalar(3.2);
    (this.backdrop.material as THREE.SpriteMaterial).color.setHex(skin.glow);
    (this.spotMesh.material as THREE.MeshBasicMaterial).color.setHex(skin.core);
    (this.poolMesh.material as THREE.MeshBasicMaterial).color.setHex(skin.glow);
    (this.motes.material as THREE.PointsMaterial).color.setHex(skin.core);
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  resetView() {
    this.camera.position.set(0, 0.91, 11.44);
    this.controls.target.set(0, 0.05, 0);
    this.controls.update();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.controls.update();

    this.rigHolder.position.y = Math.sin(this.time * 1.4) * 0.07;
    this.rig?.update(dt, this.time, 1, 0.25);
    const hm = this.halo.material as THREE.SpriteMaterial;
    hm.rotation = this.time * 0.22;
    this.halo.scale.setScalar(3.2 + Math.sin(this.time * 3) * 0.15);

    // Фоновое свечение всегда позади объекта относительно камеры
    this.tmp.copy(this.camera.position).sub(this.controls.target).normalize().multiplyScalar(-9);
    this.backdrop.position.copy(this.controls.target).add(this.tmp);

    // пятно света мягко «дышит» вместе с искрой
    const breathe = 1 + Math.sin(this.time * 1.4) * 0.06;
    this.spotMesh.scale.set(breathe, breathe, 1);
    (this.spotMesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(this.time * 2) * 0.08;
    (this.poolMesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.time * 1.4 + 1) * 0.04;

    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const ang = this.moteSeeds[i * 3] + this.time * (0.25 + (i % 5) * 0.06);
      const rad = this.moteSeeds[i * 3 + 1];
      const h = (this.moteSeeds[i * 3 + 2] + this.time * (0.07 + (i % 4) * 0.02)) % 1;
      pos.setXYZ(i, Math.cos(ang) * rad, -1.5 + h * 3.6, Math.sin(ang) * rad);
    }
    pos.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.rig?.dispose();
    for (const d of this.toDispose) d.dispose();
    for (const s of this.stars) disposePoints(s);
    (this.halo.material as THREE.Material).dispose();
    (this.backdrop.material as THREE.Material).dispose();
    this.glowTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// ======================================================================
// Тоннель: два режима — «изнутри» (как в игре, обзор 360°) и «снаружи» (разрез-диорама)
// ======================================================================
export type TunnelMode = 'inside' | 'outside';

interface Section {
  group: THREE.Group;
  wall: THREE.Mesh;
  rings: THREE.Group[];
  span: number;
  dispose: () => void;
}

export class TunnelViewer3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
  private controls: OrbitControls;
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private scroll = 0;
  private ro: ResizeObserver;
  private disposed = false;

  private mode: TunnelMode = 'inside';
  private flight = true;
  private autoRotate = true;
  private theme!: Theme;

  private glowTex = makeGlowTexture();
  private raysTex = makeRaysTexture();
  private ringTex = makeThinRingTexture();

  private fog = new THREE.FogExp2(0x050814, 0.011);
  private inner: Section | null = null;
  private outer: Section | null = null;
  private ribGeos: RibGeos | null = null;
  private ribMats: RibMats = createRibMats();
  private themeStuff: Disposable[] = [];
  private themeObjs: THREE.Object3D[] = [];

  private skyDome: SkyDome = createSkyDome();
  private space = new THREE.Group();
  private starsA: THREE.Points;
  private starsB: THREE.Points;
  private planets: THREE.Mesh[] = [];
  private nebulae: THREE.Sprite[] = [];
  private coreGlow: THREE.Sprite;
  private coreRays: THREE.Sprite;
  private coreRing: THREE.Sprite;

  private dust: THREE.Points | null = null;
  private streaks: THREE.Points | null = null;
  private tunnelFx: TunnelFx | null = null;
  private runwayTexInner: THREE.Texture | null = null;

  private player = new THREE.Group();
  private playerRig: SparkRig | null = null;
  private playerGlow: THREE.Sprite;

  constructor(canvas: HTMLCanvasElement, themeId: string, skinId: string) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x050814);
    this.scene.fog = this.fog;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    this.scene.add(this.skyDome.mesh);

    this.space.renderOrder = -15;
    this.scene.add(this.space);
    this.starsA = makeStars(380, 0xc9dbff, 1.7, 0.65, 110, 120);
    this.starsB = makeStars(120, 0xfff0d0, 2.8, 0.35, 115, 110);
    this.space.add(this.starsA, this.starsB);

    const mkCore = (tex: THREE.Texture) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
      );
      this.scene.add(sp);
      return sp;
    };
    this.coreGlow = mkCore(this.glowTex);
    this.coreRays = mkCore(this.raysTex);
    this.coreRing = mkCore(this.ringTex);

    // Искра игрока для масштаба и ощущения «как в игре» (только в режиме «изнутри»)
    this.player.position.set(0, -4, 0);
    this.player.scale.setScalar(0.85);
    this.playerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    this.playerGlow.scale.setScalar(3.1);
    this.player.add(this.playerGlow);
    this.scene.add(this.player);
    this.setSkin(skinId);

    this.theme = themeById(themeId);
    this.buildTheme();
    this.applyMode();

    const host = canvas.parentElement ?? canvas;
    this.ro = new ResizeObserver(() => fitRenderer(this.renderer, this.camera, host));
    this.ro.observe(host);
    fitRenderer(this.renderer, this.camera, host);
    this.loop();
  }

  // ---------- публичный API ----------
  setSkin(id: string) {
    if (this.playerRig) {
      this.player.remove(this.playerRig.group);
      this.playerRig.dispose();
    }
    this.playerRig = buildSparkRig(skinById(id));
    this.player.add(this.playerRig.group);
    const gm = this.playerGlow.material as THREE.SpriteMaterial;
    gm.map = this.playerRig.coronaTex;
    gm.needsUpdate = true;
  }

  setMode(m: TunnelMode) {
    if (m === this.mode) return;
    this.mode = m;
    this.applyMode();
  }

  setFlight(on: boolean) {
    this.flight = on;
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    if (this.mode === 'outside') this.controls.autoRotate = on;
  }

  resetView() {
    this.applyMode();
  }

  setTheme(id: string) {
    this.theme = themeById(id);
    this.buildTheme();
    this.applyMode();
  }

  // ---------- построение ----------
  private clearTheme() {
    for (const o of this.themeObjs) this.scene.remove(o);
    this.themeObjs = [];
    for (const d of this.themeStuff) d.dispose();
    this.themeStuff = [];
    disposeRibGeos(this.ribGeos);
    this.ribGeos = null;
    this.inner = null;
    this.outer = null;
    this.dust = null;
    this.streaks = null;
    this.tunnelFx = null;
    this.runwayTexInner = null;
    for (const p of this.planets) {
      this.space.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    this.planets = [];
    for (const n of this.nebulae) {
      this.space.remove(n);
      (n.material as THREE.Material).dispose();
    }
    this.nebulae = [];
  }

  private makeSection(wallTex: THREE.Texture, len: number, ringCount: number, ringStartZ: number, wallZ: number, isInner: boolean): Section {
    const t = this.theme;
    const look = t.look;
    const group = new THREE.Group();
    const disposables: Disposable[] = [];

    const wallGeo = new THREE.CylinderGeometry(TUNNEL_R + 0.4, TUNNEL_R + 0.4, len, 48, 1, true);
    wallGeo.rotateX(Math.PI / 2);
    const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, transparent: true, opacity: 0.84, depthWrite: false });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.renderOrder = -1;
    wall.position.z = wallZ;
    group.add(wall);
    disposables.push(wallGeo, wallMat);

    // Продольные лучи
    const beamMat = new THREE.MeshBasicMaterial({ color: t.beam, transparent: true, opacity: 0.08 });
    const strutMat = new THREE.MeshBasicMaterial({ color: t.strut, transparent: true, opacity: 0.08 });
    const even: THREE.BufferGeometry[] = [];
    const odd: THREE.BufferGeometry[] = [];
    let n = 0;
    for (let i = 0; i < look.beams.count; i++) {
      const a = beamAngle(i, look.beams.count);
      const fromFloor = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
      if (fromFloor < 0.75) continue;
      const bg = new THREE.BoxGeometry(look.beams.width, look.beams.width, len);
      bg.rotateZ(a);
      bg.translate(Math.cos(a) * (TUNNEL_R + 0.02), Math.sin(a) * (TUNNEL_R + 0.02), wallZ);
      (n++ % 2 === 0 ? even : odd).push(bg);
    }
    if (even.length) {
      const g = mergeSimpleGeometries(even);
      group.add(new THREE.Mesh(g, beamMat));
      disposables.push(g);
    }
    if (odd.length) {
      const g = mergeSimpleGeometries(odd);
      group.add(new THREE.Mesh(g, strutMat));
      disposables.push(g);
    }
    disposables.push(beamMat, strutMat);

    // Дорожка и перила
    const runTex = makeRunwayTexture();
    runTex.repeat.set(1, len / 21);
    const runMat = new THREE.MeshBasicMaterial({
      map: runTex,
      color: t.runway,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const runGeo = new THREE.CylinderGeometry(TUNNEL_R - 0.04, TUNNEL_R - 0.04, len, 8, 1, true, -0.17, 0.34);
    runGeo.rotateX(Math.PI / 2);
    const runway = new THREE.Mesh(runGeo, runMat);
    runway.position.z = wallZ;
    group.add(runway);
    disposables.push(runTex, runMat, runGeo);
    if (isInner) this.runwayTexInner = runTex;

    const railMat = new THREE.MeshBasicMaterial({ color: t.rail, transparent: true, opacity: 0.22 });
    const railGeos: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const rg = new THREE.BoxGeometry(0.04, 0.04, len);
      const a = -Math.PI / 2 + side * 0.42;
      rg.rotateZ(a);
      rg.translate(Math.cos(a) * (TUNNEL_R - 0.02), Math.sin(a) * (TUNNEL_R - 0.02), wallZ);
      railGeos.push(rg);
    }
    const railMerged = mergeSimpleGeometries(railGeos);
    group.add(new THREE.Mesh(railMerged, railMat));
    disposables.push(railMat, railMerged);

    // Внешние шпангоуты
    const strutGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < Math.max(2, Math.floor(len / 46)); i++) {
      const sg = new THREE.TorusGeometry(TUNNEL_R + 1.05, 0.05, 3, 28);
      sg.translate(0, 0, wallZ + len / 2 - 8 - i * 46);
      strutGeos.push(sg);
    }
    const strutMerged = mergeSimpleGeometries(strutGeos);
    const strutOuterMat = new THREE.MeshBasicMaterial({ color: t.strut, transparent: true, opacity: 0.25 });
    group.add(new THREE.Mesh(strutMerged, strutOuterMat));
    disposables.push(strutMerged, strutOuterMat);

    // Рёбра по ритму тоннеля
    const rings: THREE.Group[] = [];
    for (let i = 0; i < ringCount; i++) {
      const g = new THREE.Group();
      g.position.z = ringStartZ - i * RING_GAP;
      const letter = look.ribPattern[i % look.ribPattern.length];
      for (const m of ribPieces(letter, this.ribGeos!, this.ribMats)) g.add(m);
      group.add(g);
      rings.push(g);
    }

    return {
      group,
      wall,
      rings,
      span: ringCount * RING_GAP,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  private buildTheme() {
    this.clearTheme();
    const t = this.theme;
    const look = t.look;
    (this.scene.background as THREE.Color).set(t.sky);
    this.fog.color.set(t.fog);
    this.skyDome.setTheme(look.panel);

    this.ribGeos = buildRibGeos(look, TUNNEL_R);

    // Одна текстура стены на оба режима (клон делит холст)
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const texIn = paintWallTexture(look, t.wall, 4, aniso);
    const texOut = texIn.clone();
    texOut.repeat.set(1, 1);
    texOut.needsUpdate = true;
    this.themeStuff.push(texIn, texOut);

    // «Изнутри»: 256 м, 32 ребра, скользит как в игре
    this.inner = this.makeSection(texIn, 256, 32, 0, -100, true);
    this.tunnelFx = createTunnelFx(TUNNEL_R + 0.3, 256, -100);
    this.tunnelFx.setLook(look);
    this.inner.group.add(this.tunnelFx.mesh);
    this.scene.add(this.inner.group);
    this.themeObjs.push(this.inner.group);
    this.themeStuff.push(this.inner, this.tunnelFx);

    // «Снаружи»: диорама 64 м; зрителю видна внутренняя сторона дальней половины обшивки
    this.outer = this.makeSection(texOut, 64, 8, 28, 0, false);
    this.scene.add(this.outer.group);
    this.themeObjs.push(this.outer.group);
    this.themeStuff.push(this.outer);

    // Пыль и линии скорости (только «изнутри»)
    const dn = look.dust.n;
    const dpos = new Float32Array(dn * 3);
    const dcol = new Float32Array(dn * 3);
    const c = new THREE.Color();
    for (let i = 0; i < dn; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * (TUNNEL_R - 1.1);
      dpos[i * 3] = Math.cos(a) * r;
      dpos[i * 3 + 1] = Math.sin(a) * r;
      dpos[i * 3 + 2] = 12 - Math.random() * 250;
      c.setHex(look.dust.colors[i % look.dust.colors.length]);
      dcol.set([c.r, c.g, c.b], i * 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dg.setAttribute('color', new THREE.BufferAttribute(dcol, 3));
    const dm = new THREE.PointsMaterial({
      vertexColors: true,
      size: look.dust.size * 1.4,
      transparent: true,
      opacity: look.dust.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dust = new THREE.Points(dg, dm);
    this.scene.add(this.dust);
    this.themeObjs.push(this.dust);
    this.themeStuff.push(dg, dm);

    const sn = 90;
    const spos = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = TUNNEL_R - 0.35 - Math.random() * 0.5;
      spos[i * 3] = Math.cos(a) * r;
      spos[i * 3 + 1] = Math.sin(a) * r;
      spos[i * 3 + 2] = 12 - Math.random() * 250;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    const sm = new THREE.PointsMaterial({
      color: look.streak.color,
      size: 0.09,
      transparent: true,
      opacity: 0.2 * look.streak.gain,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.streaks = new THREE.Points(sg, sm);
    this.scene.add(this.streaks);
    this.themeObjs.push(this.streaks);
    this.themeStuff.push(sg, sm);

    // Космос: звёзды темы (без лишних размытых планет и пятен)
    (this.starsA.material as THREE.PointsMaterial).color.setHex(t.stars);
    (this.starsB.material as THREE.PointsMaterial).color.setHex(t.starBright);

    // Ядро
    for (const sp of [this.coreGlow, this.coreRays]) (sp.material as THREE.SpriteMaterial).color.setHex(look.core.color);
    (this.coreRing.material as THREE.SpriteMaterial).color.setHex(0xffffff);
  }

  private applyMode() {
    const inside = this.mode === 'inside';
    const look = this.theme.look;
    if (this.inner) this.inner.group.visible = inside;
    if (this.outer) this.outer.group.visible = !inside;
    if (this.dust) this.dust.visible = inside;
    if (this.streaks) this.streaks.visible = inside;
    this.player.visible = inside;

    const coreZ = inside ? -110 : -56;
    for (const sp of [this.coreGlow, this.coreRays, this.coreRing]) sp.position.set(0, 0, coreZ);

    if (inside) {
      this.fog.density = look.fog;
      // Обзор 360° из точки, где стоит камера игры: «орбита» с радиусом 1 см вокруг камеры
      const isTouch = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      const isMobile = isTouch || aspect < 1.2;
      this.camera.fov = isMobile ? 78 : 75;
      this.camera.updateProjectionMatrix();
      this.controls.autoRotate = false;
      this.controls.enableZoom = false;
      this.controls.minDistance = 0.01;
      this.controls.maxDistance = 0.01;
      this.controls.minPolarAngle = 0.25;
      this.controls.maxPolarAngle = Math.PI - 0.25;
      this.controls.rotateSpeed = -0.45;
      // Только передняя полусфера: 180° по горизонтали (±90° от направления бега), назад не повернуться
      this.controls.minAzimuthAngle = -Math.PI / 2;
      this.controls.maxAzimuthAngle = Math.PI / 2;
      const camPos = new THREE.Vector3(0, isMobile ? 0.88 : 0.8, isMobile ? 8.35 : 7);
      const dir = new THREE.Vector3(0, -1.7, -27).normalize();
      this.controls.target.copy(camPos).addScaledVector(dir, 0.01);
      this.camera.position.copy(camPos);
      this.controls.update();
    } else {
      this.fog.density = 0.0028;
      this.camera.fov = 44;
      this.camera.updateProjectionMatrix();
      this.controls.minDistance = 22;
      this.controls.maxDistance = 160;
      this.controls.enableZoom = true;
      this.controls.minPolarAngle = 0.05;
      this.controls.maxPolarAngle = Math.PI - 0.05;
      this.controls.rotateSpeed = 0.8;
      this.controls.minAzimuthAngle = -Infinity;
      this.controls.maxAzimuthAngle = Infinity;
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 1.4;
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(-80, 30, 30);
      this.controls.update();
    }
  }

  // ---------- кадр ----------
  private updateRibLook() {
    const look = this.theme.look;
    const rc = look.ribColors;
    const m = this.ribMats;
    m.body.color.setHex(rc.body);
    if (look.hueSway) {
      const sw = look.hueSway;
      const h = sw.from + (sw.to - sw.from) * (0.5 + 0.5 * Math.sin(this.time * sw.speed * 2));
      m.edge.color.setHSL(h, 0.9, 0.66);
    } else {
      m.edge.color.setHex(rc.edge);
    }
    m.accent.color.setHex(rc.accent);
    m.dim.color.setHex(rc.dim);
    m.halo.color.copy(m.edge.color);
    m.halo.opacity = look.halo * (this.mode === 'outside' ? 1.4 : 1);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.controls.update();
    this.updateRibLook();

    const look = this.theme.look;
    const c = look.core;
    const inside = this.mode === 'inside';
    const k = inside ? 1 : 0.75;
    const pulse = 1 + Math.sin(this.time * 1.3) * 0.05;
    (this.coreGlow.material as THREE.SpriteMaterial).opacity = c.opacity * (inside ? 1 : 0.8);
    this.coreGlow.scale.setScalar(c.size * k * pulse);
    const rm = this.coreRays.material as THREE.SpriteMaterial;
    rm.opacity = c.rays;
    this.coreRays.visible = c.rays > 0;
    this.coreRays.scale.setScalar(c.size * k);
    rm.rotation += dt * 0.12;
    (this.coreRing.material as THREE.SpriteMaterial).opacity = c.ring;
    this.coreRing.visible = c.ring > 0;
    this.coreRing.scale.setScalar(c.size * k * 0.9 * (1 + Math.sin(this.time * 0.9) * 0.03));

    this.skyDome.update(this.time, 1);
    this.space.rotation.z += dt * 0.012;

    if (inside) {
      const move = (this.flight ? 27 : 0) * dt;
      this.scroll += move;
      if (this.inner) {
        for (let i = 0; i < this.inner.rings.length; i++) {
          this.inner.rings[i].position.z = -i * RING_GAP;
        }
        const map = (this.inner.wall.material as THREE.MeshBasicMaterial).map;
        if (map) map.offset.y = -((this.scroll * 0.14) / WALL_TILE) % 1;
      }
      if (this.runwayTexInner) this.runwayTexInner.offset.y = -(this.scroll / 64) % 1;
      this.tunnelFx?.update(this.time, this.scroll, 0.55);
      if (this.dust) {
        const attr = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
        const a = attr.array as Float32Array;
        for (let i = 2; i < a.length; i += 3) {
          a[i] += move;
          if (a[i] > 12) a[i] -= 262;
        }
        attr.needsUpdate = true;
      }
      if (this.streaks) {
        const attr = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
        const a = attr.array as Float32Array;
        for (let i = 2; i < a.length; i += 3) {
          a[i] += move * 1.4;
          if (a[i] > 14) a[i] -= 264;
        }
        attr.needsUpdate = true;
      }
      this.player.position.y = -4 + Math.sin(this.time * 1.4) * 0.16;
      this.playerRig?.update(dt, this.time, 1, 0.3);
      const gm = this.playerGlow.material as THREE.SpriteMaterial;
      gm.rotation = this.time * 0.22;
      this.playerGlow.scale.setScalar(3.0 + Math.sin(this.time * 3) * 0.3);
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.clearTheme();
    this.skyDome.dispose();
    this.playerRig?.dispose();
    for (const m of Object.values(this.ribMats)) m.dispose();
    disposePoints(this.starsA);
    disposePoints(this.starsB);
    for (const sp of [this.coreGlow, this.coreRays, this.coreRing, this.playerGlow]) (sp.material as THREE.Material).dispose();
    this.glowTex.dispose();
    this.raysTex.dispose();
    this.ringTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
