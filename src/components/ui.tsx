import { memo, useState } from 'react';
import { Radio, Sparkles, Zap } from 'lucide-react';
import type { RadarDot } from '../game/Engine';
import type { Sound } from '../game/Sound';

// Глобальный доступ к звуковому движку для UI-откликов.
let uiSound: Sound | null = null;
export function setUiSound(s: Sound | null) {
  uiSound = s;
}

/** Короткая пробная мелодия — кнопка «Тест звука» в правилах. */
export function uiTestSound() {
  uiSound?.resume();
  uiSound?.powerup();
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
      onMouseEnter={() => {
        setHover(true);
        if (!disabled) uiSound?.hover();
      }}
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
export const Sonar = memo(function Sonar({ dots, active }: { dots: RadarDot[]; active: boolean }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <svg width="172" height="52" viewBox="0 0 210 66" className="overflow-visible">
        <defs>
          <linearGradient id="sonarFade" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#23e0b6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#23e0b6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M5 64 L105 4 L205 64 Z" fill="url(#sonarFade)" opacity="0.22" />
        <path d="M5 64 L105 4 L205 64" fill="none" stroke="rgba(110,247,216,0.28)" strokeWidth="1" />
        <path d="M42 64 L105 22 L168 64" fill="none" stroke="rgba(110,247,216,0.16)" strokeWidth="1" />
        {dots.map((d, i) => {
          const x = 8 + d.x * 194;
          const y = 62 - d.y * 56;
          if (d.k === 0) return <circle key={i} cx={x} cy={y} r={2.6} fill="#ff2f74" />;
          if (d.k === 2) {
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={4.2} fill="none" stroke="#6ef7d8" strokeWidth="1.2" opacity="0.85" />
                <circle cx={x} cy={y} r={2.1} fill="#6ef7d8" />
              </g>
            );
          }
          return <rect key={i} x={x - 1.8} y={y - 1.8} width="3.6" height="3.6" fill="#ffd166" transform={`rotate(45 ${x} ${y})`} />;
        })}
        <g className={active ? 'animate-breathe' : ''}>
          <circle cx="105" cy="62" r="4.5" fill="#fff4d6" />
          <circle cx="105" cy="62" r="9" fill="none" stroke="#ffb03a" strokeWidth="1.2" opacity="0.6" />
        </g>
      </svg>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-sonar-300/95">
        <Radio size={10} /> сонар
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
          className="h-full transition-[width] duration-100"
          style={{ width: `${k * 100}%`, background: `linear-gradient(90deg, ${tone}, #fff4d6)`, boxShadow: `0 0 14px ${tone}` }}
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

export function PowerIcon({ kind, size = 15 }: { kind: 'orb' | 'flash' | 'magnet' | 'shard' | 'combo'; size?: number }) {
  if (kind === 'flash') return <Zap size={size} />;
  if (kind === 'orb') return <Sparkles size={size} />;
  if (kind === 'shard') return <Zap size={size} />;
  return <Radio size={size} />;
}
