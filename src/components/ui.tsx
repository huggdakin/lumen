import { memo, useEffect, useRef, useState } from 'react';
import { Radio, Sparkles, Zap } from 'lucide-react';
import { liveSonarFrame, type RadarDot } from '../game/Engine';
import type { Sound } from '../game/Sound';

// Глобальный доступ к звуковому движку для UI-откликов.
let uiSound: Sound | null = null;
export function setUiSound(s: Sound | null) {
  uiSound = s;
}

/**
 * Глобальный звук наведения: любая потенциально кликабельная кнопка/ссылка во всей игре
 * (магазин, меню, пауза, 3D-осмотр, плашки) мягко «отзывается» при наведении.
 */
export function installHoverSound(): () => void {
  if (typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) {
    return () => {};
  }
  let last: Element | null = null;
  const sel = 'button, a[href], [role="button"], summary, label[for], input[type="button"], input[type="submit"]';
  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const t = e.target as Element | null;
    const el = t?.closest?.(sel) ?? null;
    if (el === last) return;
    last = el;
    if (!el) return;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    uiSound?.hover();
  };
  const onLeave = () => {
    last = null;
  };
  document.addEventListener('pointerover', onOver, true);
  document.addEventListener('pointerleave', onLeave, true);
  return () => {
    document.removeEventListener('pointerover', onOver, true);
    document.removeEventListener('pointerleave', onLeave, true);
  };
}

/** Короткая пробная мелодия — кнопка «Тест звука» в правилах. */
export function uiTestSound() {
  uiSound?.resume();
  uiSound?.powerup();
}

export function detectIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touch = navigator.maxTouchPoints > 0;
  const narrow = window.innerWidth < 768;
  const shortLandscape = window.innerHeight <= 540 && window.innerWidth < 1024;
  return coarse || (touch && (narrow || shortLandscape)) || narrow;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(detectIsMobile);
  useEffect(() => {
    const onResize = () => setIsMobile(detectIsMobile());
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

export const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export const cut = (n = 14) => ({
  clipPath: `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`,
});

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'reward' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const pad = size === 'lg' ? 'px-10 py-4 text-lg' : size === 'sm' ? 'px-3.5 py-2 text-[13px]' : 'px-7 py-3 text-base';
  const base =
    'pointer-events-auto relative inline-flex items-center justify-center gap-2.5 font-display font-bold uppercase tracking-[0.06em] overflow-hidden transition-all duration-150 active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45';
  const styles = {
    primary: disabled
      ? 'bg-ink-700 text-white/78'
      : 'bg-gradient-to-r from-ember-300 via-ember-400 to-ember-500 text-ink-950 shadow-[0_10px_40px_-12px_rgba(255,176,58,0.9)] hover:-translate-y-0.5 hover:shadow-[0_16px_50px_-10px_rgba(255,176,58,1)]',
    reward:
      'bg-gradient-to-r from-sonar-400 via-myst-400 to-myst-500 text-white shadow-[0_10px_40px_-14px_rgba(139,98,255,0.95)] hover:-translate-y-0.5',
    ghost: 'bg-white/[0.07] text-white/90 border border-white/15 hover:bg-white/[0.13] hover:text-white',
    quiet: 'bg-transparent text-white/88 hover:text-white',
  }[variant];
  return (
    <button
      onClick={() => {
        if (disabled) return;
        uiSound?.click();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{ ...cut(12) }}
      className={`${base} ${pad} ${styles} ${className}`}
    >
      {variant === 'primary' && !disabled && (
        <span
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/35 blur-[6px]"
          style={{ animation: hover ? 'sheen 0.9s ease-out' : 'none' }}
        />
      )}
      {icon}
      {children}
    </button>
  );
}

export function Panel({
  title,
  icon,
  children,
  className = '',
  tone = 'ink',
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: 'ink' | 'ember' | 'sonar';
}) {
  const ring = {
    ink: 'border-white/20 bg-ink-900/94',
    ember: 'border-ember-300/40 bg-ink-900/94',
    sonar: 'border-sonar-400/40 bg-ink-900/94',
  }[tone];
  return (
    <div style={cut(16)} className={`relative border ${ring} backdrop-blur-md ${className}`}>
      <span className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-white/25" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-white/25" />
      {title && (
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="text-ember-300">{icon}</span>
          <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-white/95">{title}</h3>
          <span className="ml-auto h-px flex-1 bg-gradient-to-r from-white/18 to-transparent" />
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Bar({ v, tone = 'ember', thin }: { v: number; tone?: 'ember' | 'sonar' | 'myst'; thin?: boolean }) {
  const g = {
    ember: 'from-ember-300 to-ember-500',
    sonar: 'from-sonar-300 to-sonar-500',
    myst: 'from-myst-300 to-myst-500',
  }[tone];
  return (
    <div className={`${thin ? 'h-1' : 'h-1.5'} w-full overflow-hidden bg-white/10`}>
      <div
        className={`h-full bg-gradient-to-r ${g} transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }}
      />
    </div>
  );
}

export function MusicStepper({ level, onChange }: { level: number; onChange: (v: number) => void }) {
  const labels = ['выкл', 'тихо', 'обычно'];
  return (
    <div className="pointer-events-auto flex items-center gap-1 border border-white/14 bg-ink-950/70 px-1.5 py-1" style={cut(8)}>
      <span className="pl-1 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">музыка</span>
      {labels.map((l, i) => (
        <button
          key={l}
          onClick={() => {
            uiSound?.click();
            onChange(i);
          }}
          className={`px-2 py-0.5 font-display text-[10px] font-bold uppercase transition-all ${
            level === i ? 'bg-ember-400/25 text-ember-200' : 'text-white/65 hover:bg-white/10 hover:text-white'
          }`}
          style={cut(5)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Сонар: веер вперёд, точки — осколки (горячий) и светлячки (тёплый). */
/**
 * Сонар — компактная проекция «что ждёт впереди»: перспективная трапеция, где низ — мы, верх — 115 м вперёд.
 * Горизонталь — угол относительно нашей дуги, глубина нелинейная (ближние объекты подробнее).
 * Стенки рисуются настоящими отрезками (виден зев), охотники — звёздочками, а если на нашей дуге
 * впереди угроза — дорожка краснеет до неё: сразу видно, где и как далеко нужно сворачивать.
 */
/**
 * Сонар на прозрачном фоне: полупрозрачный серо-голубой 3D-тоннель, вид сбоку под углом 60° для наглядности.
 * Отрисовывается на высокочётком Canvas с частотой кадров самой игры (60/120 FPS), плавно показывая
 * движение колец тоннеля, нашу искру и все объекты впереди (мины, охотники, стенки-дуги, светлячки, баффы).
 */
export const Sonar = memo(function Sonar({ dots: fallbackDots, active }: { dots?: RadarDot[]; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef(fallbackDots);
  fallbackRef.current = fallbackDots;
  const activeRef = useRef(active);
  activeRef.current = active;
  const isMobile = useIsMobile();

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = 186;
    const H = 82;
    let scaleX = 1;
    let scaleY = 1;
    let forceRedraw = true;

    const syncCanvasResolution = () => {
      const mobile = detectIsMobile();
      const cssW = cvs.clientWidth || (mobile ? 135 : 301);
      const cssH = cvs.clientHeight || (mobile ? 59 : 133);
      const rawDpr = window.devicePixelRatio || 1;
      // На ПК используем повышенный суперсэмплинг (>= 2.25x от CSS-размера 301×133), чтобы увеличенный на 20% сонар был идеально чётким
      const dpr = mobile ? Math.min(2.25, Math.max(1.5, rawDpr)) : Math.min(3.0, Math.max(2.25, rawDpr * 1.5));
      const targetW = Math.round(cssW * dpr);
      const targetH = Math.round(cssH * dpr);
      if (cvs.width !== targetW || cvs.height !== targetH) {
        cvs.width = targetW;
        cvs.height = targetH;
      }
      scaleX = cvs.width / W;
      scaleY = cvs.height / H;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      forceRedraw = true;
    };
    syncCanvasResolution();
    window.addEventListener('resize', syncCanvasResolution, { passive: true });

    // Проекция цилиндра под углом 60° сбоку:
    // t = 0 — срез игрока (слева-внизу), t = 1 — дальний срез тоннеля (справа-вверху, 115 м впереди).
    // За счёт ракурса 60° (cos 60° = 0.5) каждое сечение тоннеля раскрыто в эллипс (rx = R * 0.5, ry = R),
    // поэтому идеально читаются и дистанция вперёд, и угол вокруг стенок трубы.
    const x0 = 34;
    const y0 = 51;
    const x1 = 156;
    const y1 = 25;
    const r0 = 22.5;
    const r1 = 14.5;
    const COS60 = 0.5; // cos(60°) — раскрытие круга сечения при взгляде под 60°
    const dxTube = x1 - x0;
    const dyTube = y1 - y0;
    const drTube = r1 - r0;

    // Скалярная проекция без аллокации массивов на каждый вызов
    let projX = 0;
    let projY = 0;
    let projDepth = 0;
    const projectPoint = (t: number, ang: number) => {
      const cx = x0 + dxTube * t;
      const cy = y0 + dyTube * t;
      const R = r0 + drTube * t;
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      projX = cx + sinA * (R * COS60);
      projY = cy + cosA * R;
      projDepth = t * 2 - sinA * 0.35;
    };

    // Предвычисляем статичные точки контура и градиент трубы один раз (0 аллокаций в цикле)
    projectPoint(0, Math.PI);
    const top0x = projX;
    const top0y = projY;
    projectPoint(0, 0);
    const bot0x = projX;
    const bot0y = projY;
    projectPoint(1, Math.PI);
    const top1x = projX;
    const top1y = projY;
    projectPoint(1, 0);
    const bot1x = projX;
    const bot1y = projY;

    const tubeGrad = ctx.createLinearGradient(x0, y0 - r0, x1, y1 + r1);
    tubeGrad.addColorStop(0, 'rgba(132, 172, 208, 0.20)');
    tubeGrad.addColorStop(0.55, 'rgba(110, 150, 188, 0.13)');
    tubeGrad.addColorStop(1, 'rgba(92, 130, 168, 0.06)');

    const guideLines = [-Math.PI * 0.68, -Math.PI * 0.35, Math.PI * 0.35, Math.PI * 0.68].map((genAng) => {
      projectPoint(0, genAng);
      const gx0 = projX;
      const gy0 = projY;
      projectPoint(1, genAng);
      return { gx0, gy0, gx1: projX, gy1: projY, front: genAng > 0 };
    });

    interface SonarSlot {
      d: RadarDot;
      ang: number;
      t: number;
      px: number;
      py: number;
      depthKey: number;
    }
    const dummyDot: RadarDot = { x: 0.5, y: 0, k: 0 };
    const slotPool: SonarSlot[] = Array.from({ length: 64 }, () => ({
      d: dummyDot,
      ang: 0,
      t: 0,
      px: 0,
      py: 0,
      depthKey: 0,
    }));
    const activeItems: SonarSlot[] = [];
    const ringTs: number[] = [];

    let lastScrollZ = -999999;
    let lastActive = !activeRef.current;
    let lastDotsCount = -1;
    let raf = 0;

    const render = () => {
      raf = requestAnimationFrame(render);
      const dots = liveSonarFrame.dots.length ? liveSonarFrame.dots : (fallbackRef.current ?? []);
      const scrollZ = liveSonarFrame.scrollZ;
      const isAct = activeRef.current;

      // Если игра на паузе и состояние сонара не менялось — не перерисовываем холст вхолостую
      if (!forceRedraw && scrollZ === lastScrollZ && isAct === lastActive && dots.length === lastDotsCount) {
        return;
      }
      forceRedraw = false;
      lastScrollZ = scrollZ;
      lastActive = isAct;
      lastDotsCount = dots.length;

      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.clearRect(0, 0, W, H); // полностью прозрачный фон

      // Проверяем, есть ли на курсе игрока (ang ≈ 0) преграда впереди
      let laneThreatT = 1.1;
      const count = Math.min(dots.length, slotPool.length);
      activeItems.length = count;

      for (let i = 0; i < count; i++) {
        const d = dots[i];
        const ang = d.ang ?? (d.x - 0.5) * 2.8;
        const t = Math.pow(Math.max(0, Math.min(1, d.dist ?? d.y * d.y)), 0.78);
        const hit =
          d.k === 3
            ? Math.abs(ang) < (d.arc ?? 1.2) + 0.14
            : (d.k === 0 || d.k === 4) && Math.abs(ang) < 0.28;
        if (hit && t < laneThreatT) laneThreatT = t;

        projectPoint(t, ang);
        const slot = slotPool[i];
        slot.d = d;
        slot.ang = ang;
        slot.t = t;
        slot.px = projX;
        slot.py = projY;
        slot.depthKey = projDepth;
        activeItems[i] = slot;
      }

      // 1. Полупрозрачное серо-голубое тело тоннеля
      ctx.fillStyle = tubeGrad;
      ctx.beginPath();
      ctx.moveTo(top0x, top0y);
      ctx.lineTo(top1x, top1y);
      ctx.ellipse(x1, y1, r1 * COS60, r1, 0, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(bot0x, bot0y);
      ctx.ellipse(x0, y0, r0 * COS60, r0, 0, Math.PI / 2, -Math.PI / 2, false);
      ctx.closePath();
      ctx.fill();

      // 2. Продольные направляющие линии стенок тоннеля (серо-голубые)
      ctx.lineWidth = 0.8;
      for (let i = 0; i < guideLines.length; i++) {
        const g = guideLines[i];
        ctx.strokeStyle = g.front ? 'rgba(154, 192, 224, 0.25)' : 'rgba(122, 158, 192, 0.14)';
        ctx.beginPath();
        ctx.moveTo(g.gx0, g.gy0);
        ctx.lineTo(g.gx1, g.gy1);
        ctx.stroke();
      }

      // 3. Плавно движущиеся кольца-шпангоуты тоннеля (дальние полудуги, без аллокаций)
      const ringCount = 6;
      const phase = ((scrollZ * 0.09) % 1 + 1) % 1;
      ringTs.length = 0;
      ringTs.push(1);
      for (let i = 0; i < ringCount; i++) {
        const rt = 1 - (i + phase) / ringCount;
        if (rt > 0.04 && rt < 0.96) ringTs.push(rt);
      }
      ringTs.push(0);

      for (let i = 0; i < ringTs.length; i++) {
        const rt = ringTs[i];
        const cx = x0 + dxTube * rt;
        const cy = y0 + dyTube * rt;
        const R = r0 + drTube * rt;
        const isEnd = rt === 0 || rt === 1;
        ctx.strokeStyle = isEnd ? 'rgba(150, 188, 222, 0.42)' : 'rgba(128, 166, 200, 0.20)';
        ctx.lineWidth = isEnd ? 1.15 : 0.85;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * COS60, R, 0, Math.PI / 2, (Math.PI * 3) / 2, false);
        ctx.stroke();
      }

      // Верхний и нижний контуры цилиндра
      ctx.strokeStyle = 'rgba(156, 194, 228, 0.52)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(top0x, top0y);
      ctx.lineTo(top1x, top1y);
      ctx.stroke();

      // Нижняя линия курса игрока
      ctx.strokeStyle = 'rgba(170, 208, 240, 0.62)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bot0x, bot0y);
      ctx.lineTo(bot1x, bot1y);
      ctx.stroke();

      if (laneThreatT <= 1) {
        projectPoint(laneThreatT, 0);
        ctx.strokeStyle = 'rgba(255, 72, 124, 0.85)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(bot0x, bot0y);
        ctx.lineTo(projX, projY);
        ctx.stroke();
      }

      // 4. Объекты внутри тоннеля (сортируем от дальних к ближним без аллокаций на каждый кадр)
      activeItems.sort((a, b) => b.depthKey - a.depthKey);

      for (let i = 0; i < activeItems.length; i++) {
        const { d, ang, t, px, py } = activeItems[i];
        const near = 1 - t;
        const r = 1.7 + near * 2.1;

        if (d.k === 3) {
          const arcHalf = d.arc ?? 1.25;
          const steps = 12;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let s = 0; s <= steps; s++) {
            const a = ang - arcHalf + (s / steps) * (arcHalf * 2);
            projectPoint(t, a);
            if (s === 0) ctx.moveTo(projX, projY);
            else ctx.lineTo(projX, projY);
          }
          ctx.strokeStyle = 'rgba(255, 47, 116, 0.32)';
          ctx.lineWidth = 4.4 + near * 2.2;
          ctx.stroke();
          ctx.strokeStyle = '#ff4d82';
          ctx.lineWidth = 2.0 + near * 1.5;
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (d.k === 1) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#ffd166';
          const sz = r * 1.15;
          ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
          ctx.restore();
          continue;
        }

        if (d.k === 2) {
          ctx.strokeStyle = '#7ce8ff';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(px, py, r + 1.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#b8f4ff';
          ctx.beginPath();
          ctx.arc(px, py, r * 0.65, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (d.k === 4) {
          const o = r + 1.2;
          ctx.fillStyle = '#ff7a3c';
          ctx.strokeStyle = '#fff0e0';
          ctx.lineWidth = 0.55;
          ctx.beginPath();
          ctx.moveTo(px, py - o);
          ctx.lineTo(px + o * 0.36, py - o * 0.36);
          ctx.lineTo(px + o, py);
          ctx.lineTo(px + o * 0.36, py + o * 0.36);
          ctx.lineTo(px, py + o);
          ctx.lineTo(px - o * 0.36, py + o * 0.36);
          ctx.lineTo(px - o, py);
          ctx.lineTo(px - o * 0.36, py - o * 0.36);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          continue;
        }

        ctx.fillStyle = 'rgba(255, 47, 116, 0.28)';
        ctx.beginPath();
        ctx.arc(px, py, r + 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff3877';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Ближние к зрителю полудуги колец тоннеля
      for (let i = 0; i < ringTs.length; i++) {
        const rt = ringTs[i];
        const cx = x0 + dxTube * rt;
        const cy = y0 + dyTube * rt;
        const R = r0 + drTube * rt;
        const isEnd = rt === 0 || rt === 1;
        ctx.strokeStyle = isEnd ? 'rgba(176, 212, 242, 0.72)' : 'rgba(148, 188, 222, 0.38)';
        ctx.lineWidth = isEnd ? 1.35 : 0.95;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * COS60, R, 0, -Math.PI / 2, Math.PI / 2, false);
        ctx.stroke();
      }

      // 6. Наша главная искра в начале тоннеля (t = 0, ang = 0 -> bot0x, bot0y)
      ctx.fillStyle = 'rgba(165, 206, 240, 0.28)';
      ctx.beginPath();
      ctx.arc(bot0x, bot0y, 6.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isAct ? '#ff5a8a' : '#9ec4e4';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bot0x, bot0y, 5.4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.arc(bot0x, bot0y, 3.1, 0, Math.PI * 2);
      ctx.fill();
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', syncCanvasResolution);
    };
  }, []);

  return (
    <div className="pointer-events-none flex flex-col items-center select-none bg-transparent">
      <canvas
        ref={canvasRef}
        className={
          isMobile
            ? 'block h-[59px] w-[135px] bg-transparent'
            : 'block h-[133px] w-[301px] short:h-[59px] short:w-[135px] bg-transparent'
        }
      />
      <div
        className={`mt-0.5 flex items-center gap-1 font-display font-bold uppercase tracking-[0.28em] text-[#94b8d8] drop-shadow-[0_1px_2px_rgba(4,6,18,0.85)] ${
          isMobile ? 'text-[8px]' : 'text-[14px] short:text-[8px]'
        }`}
      >
        <Radio
          className={`text-[#8ab2d6] ${
            isMobile ? 'h-[8px] w-[8px]' : 'h-[14px] w-[14px] short:h-[8px] short:w-[8px]'
          }`}
        />{' '}
        СОНАР
      </div>
    </div>
  );
});

/** Шкала света с тревогой при нехватке. */
export const LightMeter = memo(function LightMeter({ light }: { light: number }) {
  const k = light / 100;
  const danger = k < 0.28;
  const tone = k > 0.55 ? '#ffd166' : k > 0.28 ? '#ff8a3c' : '#ff2f74';
  return (
    <div className="w-full min-w-[140px]">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/92">
          <Sparkles size={11} style={{ color: tone }} /> свет
        </span>
        <span
          className={`tnum font-display text-[11px] font-bold ${danger ? 'animate-pulse text-hot-400' : 'text-white/95'}`}
        >
          {Math.round(light)}%
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden border border-white/12 bg-ink-950/85">
        <div
          className="h-full w-full origin-left will-change-transform transition-transform duration-100"
          style={{
            transform: `scaleX(${Math.max(0, Math.min(1, k))})`,
            background: `linear-gradient(90deg, ${tone}, #fff4d6)`,
          }}
        />
        {[25, 50, 75].map((p) => (
          <span key={p} className="absolute inset-y-0 w-px bg-black/50" style={{ left: `${p}%` }} />
        ))}
      </div>
    </div>
  );
});

export function Marquee({ items }: { items: string[] }) {
  const text = items.join('  ·  ');
  return (
    <div className="pointer-events-none relative w-full overflow-hidden border-y border-white/10 bg-ink-950/80 py-1.5">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-[0.38em] text-white/95">
        <span>{text}</span>
        <span aria-hidden>{text}</span>
      </div>
    </div>
  );
}

export function PowerIcon({ kind, size = 15 }: { kind: 'orb' | 'flash' | 'magnet' | 'shard' | 'combo' | 'shield'; size?: number }) {
  if (kind === 'shield') return <ShieldBuffIcon size={size} />;
  if (kind === 'flash') return <Zap size={size} />;
  if (kind === 'orb') return <Sparkles size={size} />;
  if (kind === 'shard') return <Zap size={size} />;
  return <Radio size={size} />;
}

/**
 * Уникальная иконка баффа «Щит»: геральдический щит с беловато-серым градиентом,
 * светлым кантом и четырёхлучевой звездой-эмблемой.
 */
export function ShieldBuffIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="sbi-body" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f1f3f5" />
          <stop offset="0.5" stopColor="#b4bac2" />
          <stop offset="1" stopColor="#6b727c" />
        </linearGradient>
        <linearGradient id="sbi-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9ced5" />
        </linearGradient>
        <filter id="sbi-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      <path d="M16 3.2c2.6 1.9 5.9 2.9 9.8 3v8.6c0 6.2-3.7 10.4-9.8 13.9C9.9 25.2 6.2 21 6.2 14.8V6.2c3.9-.1 7.2-1.1 9.8-3Z" fill="#d5d9de" opacity="0.4" filter="url(#sbi-glow)" />
      <path d="M16 3c2.6 1.9 5.9 2.9 9.8 3v8.6c0 6.2-3.7 10.4-9.8 14C9.9 25 6.2 20.800 6.2 14.600V6C10.100 5.900 13.400 4.900 16 3Z" fill="url(#sbi-body)" stroke="url(#sbi-rim)" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M16 6.200c2 1.300 4.300 2.100 7 2.300v6.100c0 4.300-2.500 7.400-7 10.100-4.500-2.700-7-5.800-7-10.100V8.500c2.700-.2 5-1 7-2.300Z" fill="none" stroke="#f4f5f7" strokeWidth="0.7" opacity="0.55" />
      <path d="M16 8.800l1.700 4.600 4.600 1.700-4.600 1.700L16 21.400l-1.700-4.600-4.600-1.700 4.600-1.700L16 8.800Z" fill="#4b5058" />
      <path d="M9.400 6.800c1.700-.2 3.400-.7 5-1.600" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
