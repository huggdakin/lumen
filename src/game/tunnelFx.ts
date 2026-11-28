// Спокойный полупрозрачный текстурный слой тоннеля: даёт чёткую пространственную
// привязку (продольные направляющие, мягкая ячеистая сетка свода и деликатный градиент)
// без бегущих колец, вспышек и визуальной перегрузки при движении.
import * as THREE from 'three';
import type { TunnelLook, PanelKind } from './tunnels';

interface FxStyle {
  mode: number; // 0..7 — характер сетки каждого тоннеля
  colA: number;
  colB: number;
  speed: number;
  gain: number;
}

const STYLES: Record<PanelKind, FxStyle> = {
  // 0. Холодный импульс — спокойная архитектурная сетка и продольные направляющие
  pulse: { mode: 0, colA: 0x5ec8ff, colB: 0x2b6cde, speed: 0.08, gain: 0.45 },
  // 1. Медные кольца — матовая бронзовая текстура с тонкими продольными фасками
  copper: { mode: 1, colA: 0xf09a36, colB: 0xb85d19, speed: 0.06, gain: 0.43 },
  // 2. Полярная глубина — спокойная полупрозрачная вуаль в верхнем своде
  polar: { mode: 2, colA: 0x4de6cf, colB: 0x6c63ff, speed: 0.06, gain: 0.45 },
  // 3. Лимонный свет — лаконичная мягкая подсветка свода без лишних линий
  lemon: { mode: 3, colA: 0xffe14d, colB: 0xf59e24, speed: 0.05, gain: 0.36 },
  // 4. Нулевая точка — строгая графитовая микросетка и тонкие нити горизонта
  zero: { mode: 4, colA: 0xdce2ed, colB: 0x6e7685, speed: 0.05, gain: 0.35 },
  // 5. Жерло вулкана — спокойный базальтовый рельеф без мигания
  magma: { mode: 5, colA: 0xff5e1f, colB: 0xa81c07, speed: 0.05, gain: 0.41 },
  crystal: { mode: 6, colA: 0xc4ecff, colB: 0x4b8fe8, speed: 0.07, gain: 0.45 },
  // 7. Призматический сон — спектральные переливы и блики по своду
  prism: { mode: 7, colA: 0xe87aff, colB: 0x5ce1e6, speed: 0.07, gain: 0.43 },
};

const VERT = /* glsl */ `
  varying vec3 vPos;
  varying float vDepth;
  varying float vSceneY;
  void main() {
    vPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vSceneY = worldPos.y;
    vec4 mv = viewMatrix * worldPos;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uIntensity;
  uniform float uRaw;
  uniform float uMode;
  uniform float uSpeed;
  varying vec3 vPos;
  varying float vDepth;
  varying float vSceneY;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    const float TAU = 6.2831853;
    float ang = atan(vPos.y, vPos.x) / TAU + 0.5; // 0..1 по окружности
    // Любая «привязанная к стене» подсветка едет к камере с той же скоростью, что и текстура обшивки:
    // в тоннеле нет ничего, что двигалось бы в сторону конца тоннеля.
    float wz = vPos.z - uScroll * 0.14;

    // Спокойная подсветка верхнего свода
    float vault = pow(max(0.0, sin(ang * 3.14159265)), 1.8) * 0.1;
    vec3 baseCol = mix(uColB, uColA, 0.55 + 0.25 * sin(ang * TAU));
    if (uMode > 6.5) baseCol = mix(uColB, uColA, 0.5 + 0.5 * cos(ang * TAU));
    vec3 rgb = baseCol * vault;

    // В нижней части (под игроком) эффекты ещё мягче, чтобы дорожка и препятствия читались идеально
    float floorMask = smoothstep(-4.6, -1.2, vSceneY) * 0.65 + 0.35;
    // Плавное затухание вдали и у камеры (улучшенная видимость в конце тоннеля)
    float fade = exp(-vDepth * 0.0085) * smoothstep(4.0, 14.0, vDepth);

    vec3 shimmer = vec3(0.0);
    if (uMode > 5.5) {
      // Переливы цвета: широкие мягкие волны, бегущие вокруг оси тоннеля, плюс медленный дрейф вдоль стены
      float ph = ang * 2.0 + wz * 0.010 + uTime * uSpeed * 0.9;
      vec3 pal = 0.5 + 0.5 * cos(TAU * (ph + vec3(0.0, 0.33, 0.67)));
      vec3 flow = uMode > 6.5 ? mix(vec3(1.0), pal, 0.75) : mix(uColA, uColB, 0.5 + 0.5 * sin(TAU * ph));
      float swell = 0.5 + 0.5 * sin(ang * TAU * 3.0 - uTime * uSpeed * 2.2 + wz * 0.03);
      shimmer += flow * (0.035 + 0.075 * swell * swell);

      // Небольшие блики по обшивке: редкие, короткие, мерцающие на месте
      vec2 cell = vec2(ang * 72.0, wz / 2.6);
      vec2 id = floor(cell);
      vec2 f = fract(cell) - 0.5;
      float h = hash12(id);
      float on = step(0.84, h);
      vec2 off = (vec2(hash12(id + 7.1), hash12(id + 13.7)) - 0.5) * 0.5;
      vec2 d = (f - off) * vec2(0.46, 2.6);
      float spot = 1.0 - smoothstep(0.0, 1.0, length(d / vec2(0.1, 0.42)));
      float tw = pow(0.5 + 0.5 * sin(uTime * (0.7 + h * 1.6) + h * 61.0), 5.0);
      vec3 gcol = uMode > 6.5 ? mix(vec3(1.0), pal, 0.45) : mix(vec3(0.85, 0.96, 1.0), uColB, 0.25);
      shimmer += gcol * on * spot * spot * tw * 0.8;
    }

    float k = uIntensity * fade * floorMask;
    float ks = uRaw * fade * floorMask;
    gl_FragColor = vec4(rgb * k + shimmer * ks, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface TunnelFx {
  mesh: THREE.Mesh;
  setLook(look: TunnelLook): void;
  update(time: number, scroll: number, intensity: number): void;
  dispose(): void;
}

export function createTunnelFx(radius: number, length: number, centerZ: number): TunnelFx {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 64, 1, true);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, centerZ);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColA: { value: new THREE.Color(0x5ec8ff) },
      uColB: { value: new THREE.Color(0x2b6cde) },
      uIntensity: { value: 1 },
      uRaw: { value: 1 },
      uMode: { value: 0 },
      uSpeed: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -0.5;
  mesh.frustumCulled = false;

  let style: FxStyle = STYLES.pulse;

  return {
    mesh,
    setLook(l: TunnelLook) {
      style = STYLES[l.panel] ?? STYLES.pulse;
      const u = mat.uniforms;
      u.uMode.value = style.mode;
      u.uSpeed.value = style.speed;
      u.uColA.value.setHex(style.colA);
      u.uColB.value.setHex(style.colB);
    },
    update(time: number, scroll: number, intensity: number) {
      const u = mat.uniforms;
      u.uTime.value = time;
      u.uScroll.value = scroll;
      u.uIntensity.value = intensity * style.gain;
      u.uRaw.value = intensity;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
