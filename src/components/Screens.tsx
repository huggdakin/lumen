import { memo, useEffect, useState } from 'react';
import {
  BatteryCharging,
  ArrowRight,
  Award,
  Gauge,
  Home,
  Info,
  KeyRound,
  Magnet,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Volume2,
  Video,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import type { GameResult, HudState } from '../game/Engine';
import { BUFFS, themeById } from '../game/economy';
import { getSkinPreviewUrl } from '../game/sparkSkins';
import { skinById, type MissionDef, type SaveData } from '../game/state';
import { Bar, Btn, LightMeter, MusicStepper, Panel, Sonar, cut, uiTestSound } from './ui';

function SkinSwatch({ id, size = 44 }: { id: string; size?: number }) {
  const s = skinById(id);
  const src = getSkinPreviewUrl(s.id);
  return (
    <img
      src={src}
      alt={s.name}
      width={size}
      height={size}
      className="block shrink-0 rounded-full object-contain"
      draggable={false}
    />
  );
}

// ---------------- Загрузка ----------------
export function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950">
      <div className="font-display text-5xl font-black tracking-[-0.03em] text-ember-200 drop-shadow-[0_0_30px_rgba(255,176,58,0.5)]">
        LUMEN
      </div>
      <div className="mt-4 h-0.5 w-40 overflow-hidden bg-white/10">
        <div className="h-full w-1/2 animate-[marquee_1.1s_linear_infinite] bg-ember-300" />
      </div>
      <div className="mt-3 font-display text-[11px] uppercase tracking-[0.35em] text-white/95">запуск тоннеля</div>
    </div>
  );
}

// ---------------- Меню ----------------
export function MenuScreen({
  save,
  muted,
  missions,
  onPlay,
  onToggleMute,
  onShop,
  onLeaders,
  onInfo,
}: {
  save: SaveData;
  muted: boolean;
  missions: { def: MissionDef; p: number }[];
  onPlay: () => void;
  onToggleMute: () => void;
  onShop: (tab?: string) => void;
  onLeaders: () => void;
  onInfo: () => void;
}) {
  const skin = skinById(save.skin);
  const theme = themeById(save.theme);
  const chip =
    'pointer-events-auto flex items-center gap-2 border border-white/15 bg-white/[0.05] px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-white/85 transition-all hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10 hover:text-white';
  const loadout = save.loadout
    .map((id) => BUFFS.find((b) => b.id === id)?.name ?? '')
    .filter(Boolean)
    .join(' + ');

  const iconBtn =
    'pointer-events-auto border border-white/14 bg-white/[0.05] p-2.5 text-white/75 transition-all hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/12 hover:text-white';

  return (
    <div className="absolute inset-0 flex flex-col bg-[linear-gradient(100deg,rgba(4,3,12,0.95)_0%,rgba(8,7,24,0.78)_44%,rgba(4,3,12,0.2)_100%)]">
      {/* верхняя строка: только статус и три иконки */}
      <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
        <div className="flex min-w-0 items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.3em] text-sonar-300/95">
          <span className="h-1.5 w-1.5 shrink-0 animate-breathe rounded-full bg-sonar-400" />
          <span className="truncate">
            3D-раннер<span className="hidden sm:inline"> · Яндекс.Игры</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => onShop()} className={iconBtn} style={cut(8)} aria-label="Магазин">
            <ShoppingBag size={16} />
          </button>
          <button onClick={onLeaders} className={iconBtn} style={cut(8)} aria-label="Лидеры">
            <Users size={16} />
          </button>
          <button onClick={onToggleMute} className={iconBtn} style={cut(8)} aria-label="Звук">
            {muted ? <VolumeX size={16} className="text-white/50" /> : <Volume2 size={16} />}
          </button>
          <button onClick={onInfo} className={iconBtn} style={cut(8)} aria-label="Правила и настройки">
            <Info size={16} />
          </button>
        </div>
      </div>

      <div className="pointer-events-auto grid min-h-0 flex-1 items-center gap-5 overflow-y-auto scroll-thin px-5 pb-5 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:px-10">
        {/* идентичность и старт */}
        <div className="flex min-w-0 animate-rise flex-col items-start gap-3.5">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.4em] text-ember-300">
            свет = жизнь · свет = обзор
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.4rem,7.2vw,5.6rem)] font-black leading-[0.9] tracking-[-0.04em] text-white drop-shadow-[0_0_50px_rgba(159,196,255,0.35)]">
              LUMEN
            </h1>
            <div className="stroke-title mt-1 font-display text-[clamp(0.95rem,2.1vw,1.45rem)] font-black uppercase leading-tight tracking-[0.04em]">
              тоннель света
            </div>
          </div>
          <p className="max-w-sm text-[13px] leading-relaxed text-white/85">
            Последняя искра в мёртвом тоннеле. Свет угасает — вместе с ним гаснет и видимость.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Btn onClick={onPlay} size="lg" icon={<Play size={20} fill="currentColor" />}>
              Играть
            </Btn>
            <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-white/75">
              <KeyRound size={12} className="text-sonar-300" /> A / D · свайп
            </span>
          </div>
        </div>

        {/* одно compact-окно профиля вместо четырёх панелей */}
        <div className="flex min-w-0 animate-rise flex-col gap-2.5" style={{ animationDelay: '120ms' }}>
          <Panel tone="ember">
            <div className="flex items-start gap-4">
              <div className="min-w-0">
                <div className="font-display text-[10px] uppercase tracking-[0.24em] text-white/70">рекорд</div>
                <div className="tnum font-display text-[clamp(2rem,6vw,2.9rem)] font-black leading-none text-ember-200">
                  {save.best.toLocaleString('ru-RU')}
                </div>
              </div>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
                <span className="flex items-center gap-1.5 text-ember-200">
                  <Star size={12} fill="currentColor" />
                  <span className="tnum font-display text-[13px] font-bold">{save.sparks.toLocaleString('ru-RU')}</span>
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
              {missions.map((m) => (
                <div key={m.def.id} className="flex items-center gap-2">
                  <span className={`w-0 min-w-0 flex-1 truncate text-[11px] ${m.p >= m.def.target ? 'text-sonar-300' : 'text-white/85'}`}>
                    {m.def.label}
                  </span>
                  <span className="h-1 w-14 shrink-0 bg-white/12">
                    <span
                      className={`block h-full ${m.p >= m.def.target ? 'bg-sonar-400' : 'bg-ember-400'}`}
                      style={{ width: `${Math.min(1, m.p / m.def.target) * 100}%` }}
                    />
                  </span>
                  <span className="tnum shrink-0 text-[10px] text-ember-300/90">+{m.def.reward}✦</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5">
              <button
                onClick={() => onShop('skins')}
                className={chip}
                style={cut(6)}
              >
                <SkinSwatch id={skin.id} size={20} />
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.1em] text-white/85">{skin.name}</span>
              </button>
              <button
                onClick={() => onShop('themes')}
                className={chip}
                style={cut(6)}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }}
                />
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.1em] text-white/85">{theme.name}</span>
              </button>
              <button onClick={() => onShop('buffs')} className={chip} style={cut(6)}>
                <Zap size={12} className="text-sonar-300" />
                <span>{loadout ? `на старт: ${loadout}` : 'взять бафф'}</span>
              </button>
            </div>
          </Panel>

          <div className="flex items-center justify-end px-1">
            <span className="font-display text-[10px] uppercase tracking-[0.18em] text-white/35">
              LUMEN v2 · 3D · Яндекс.Игры
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Правила и настройки ----------------
export function InfoOverlay({
  muted,
  musicLevel,
  onToggleMute,
  onMusicLevel,
  onClose,
}: {
  muted: boolean;
  musicLevel: number;
  onToggleMute: () => void;
  onMusicLevel: (v: number) => void;
  onClose: () => void;
}) {
  const rows: { icon: React.ReactNode; name: string; text: string; tone: string }[] = [
    { icon: <Sparkles size={15} />, name: 'Светлячок', text: '+12% света, комбо до ×10', tone: 'text-ember-200' },
    { icon: <Shield size={15} />, name: 'Тёмный осколок', text: '−26% света и сброс комбо', tone: 'text-hot-300' },
    { icon: <Zap size={15} />, name: 'Вспышка', text: 'сжигает осколки и мины-охотники впереди', tone: 'text-sonar-300' },
    { icon: <Magnet size={15} />, name: 'Магнит', text: 'несколько секунд тянет свет к тебе', tone: 'text-myst-300' },
    { icon: <Target size={15} />, name: 'Впритирку', text: 'прошёл рядом с препятствием — +25 очков', tone: 'text-white' },
    { icon: <Wind size={15} />, name: 'Поток', text: '3 риска подряд → 6 секунд ×1.5 очков', tone: 'text-sonar-200' },
    { icon: <Target size={15} />, name: 'Стенка', text: 'крутится вокруг трубы — проходи в зеве по ритму', tone: 'text-hot-300' },
    { icon: <BatteryCharging size={15} />, name: 'Перезаряд', text: '4.7 сек: свет растёт, скорость +14%', tone: 'text-lime-300' },
  ];
  return (
    <div onClick={onClose} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-ink-950/92 p-4 backdrop-blur-md">
      <div className="pointer-events-auto w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <Panel tone="sonar" title="Как играть" icon={<Sparkles size={13} />}>
          <div className="flex flex-col divide-y divide-white/8">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className={`shrink-0 ${r.tone}`}>{r.icon}</span>
                <span className="w-32 shrink-0 font-display text-[11px] font-bold uppercase tracking-[0.08em]">{r.name}</span>
                <span className="min-w-0 flex-1 text-[12px] text-white/85">{r.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 font-display text-[10px] uppercase tracking-[0.16em] text-white/75">
            <KeyRound size={12} className="text-sonar-300" /> A / D · ← →
            <MousePointer2 size={12} className="ml-2 text-sonar-300" /> свайп пальцем или мышью
            <span className="ml-auto">Пробел — пауза</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <span className="font-display text-[10px] uppercase tracking-[0.18em] text-white/75">музыка</span>
            <MusicStepper level={musicLevel} onChange={onMusicLevel} />
            <button
              onClick={onToggleMute}
              className="pointer-events-auto flex items-center gap-1.5 border border-white/14 bg-white/[0.05] px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/12 hover:text-white"
              style={cut(8)}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />} {muted ? 'звук выкл' : 'звук вкл'}
            </button>
            <Btn onClick={() => uiTestSound()} size="sm" variant="ghost">
              Тест звука
            </Btn>
            <Btn onClick={onClose} size="sm" variant="ghost" className="ml-auto">
              Понятно
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------- HUD ----------------
export const Hud = memo(function Hud({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col p-3 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-6">
        <div className="w-[42%] max-w-[210px]">
          <LightMeter light={hud.light} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="tnum font-display text-[clamp(1.5rem,5.2vw,2.2rem)] font-black leading-none text-white">
            {hud.score.toLocaleString('ru-RU')}
          </div>
          <div className="mt-1 flex items-center gap-3 font-display text-[11px] uppercase tracking-[0.18em] text-white/95">
            <span className="tnum">{hud.distance} м</span>
            <span className="tnum flex items-center gap-1">
              <Gauge size={11} /> {Math.round(hud.speed * 3.6)} км/ч
            </span>
          </div>
        </div>
        <button
          onClick={onPause}
          className="pointer-events-auto border border-white/18 bg-ink-950/85 p-2.5 text-white/95 transition hover:bg-white/20 hover:text-white"
          style={cut(8)}
          aria-label="Пауза"
        >
          <Pause size={16} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-start gap-2">
        {hud.combo > 1 && (
          <div
            className="border border-ember-300/45 bg-ink-950/85 px-2.5 py-1 text-ember-200"
            style={cut(8)}
          >
            <span className="font-display text-sm font-black">×{Math.min(hud.combo, 10)}</span>
            <span className="ml-1 font-display text-[10px] uppercase tracking-[0.15em] opacity-70">комбо</span>
            <div className="mt-0.5 h-0.5 w-full bg-white/15">
              <div className="h-full bg-ember-300" style={{ width: `${hud.comboT * 100}%` }} />
            </div>
          </div>
        )}
        {hud.flow > 0 && (
          <div className="flex items-center gap-1.5 border border-sonar-400/50 bg-ink-950/85 px-2.5 py-1 text-sonar-200" style={cut(8)}>
            <Wind size={13} />
            <span className="font-display text-[11px] font-bold uppercase tracking-wider">поток ×1.5</span>
          </div>
        )}
        {hud.overcharge > 0 && (
          <div className="flex items-center gap-1 border border-lime-400/50 bg-ink-950/85 px-2 py-1 text-lime-300" style={cut(6)}>
            <BatteryCharging size={11} />
            <span className="font-display text-[10px] font-bold uppercase leading-none tracking-wider">заряд</span>
            <span className="tnum font-display text-[11px] font-bold leading-none">{hud.overcharge.toFixed(1)}с</span>
          </div>
        )}
        {hud.magnet > 0 && (
          <div className="flex items-center gap-1.5 border border-myst-400/45 bg-ink-950/85 px-2.5 py-1 text-myst-300" style={cut(8)}>
            <Magnet size={13} />
            <span className="tnum font-display text-xs font-bold">{hud.magnet.toFixed(1)}с</span>
          </div>
        )}
        {hud.shield && (
          <div className="flex items-center gap-1.5 border border-sonar-400/45 bg-ink-950/85 px-2.5 py-1 text-sonar-200" style={cut(8)}>
            <Shield size={13} />
            <span className="font-display text-[11px] font-bold uppercase tracking-widest">щит</span>
          </div>
        )}
      </div>

      <div className="pointer-events-none mt-auto flex justify-center pb-1 opacity-85">
        <Sonar dots={hud.radar} active={hud.danger > 0.6} />
      </div>

      {hud.danger > 0.72 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: `inset 0 0 ${90 + hud.danger * 80}px rgba(255,47,116,${(hud.danger - 0.72) * 1.45})` }}
        />
      )}
    </div>
  );
});

// ---------------- Пауза ----------------
export function PauseOverlay({
  hud,
  musicLevel,
  onMusicLevel,
  onResume,
  onRestart,
  onMenu,
  muted,
  onToggleMute,
}: {
  hud: HudState;
  musicLevel: number;
  onMusicLevel: (v: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-ink-950/82 p-6 backdrop-blur-md">
      <Panel tone="sonar" className="w-full max-w-sm animate-pop" title="Пауза" icon={<Pause size={13} />}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: 'очки', v: hud.score.toLocaleString('ru-RU') },
            { l: 'метры', v: hud.distance },
            { l: 'свет', v: `${Math.round(hud.light)}%` },
          ].map((s) => (
            <div key={s.l} className="border border-white/20 bg-ink-950/80 px-2 py-2" style={cut(8)}>
              <div className="tnum font-display text-lg font-bold text-white">{s.v}</div>
              <div className="font-display text-[10px] uppercase tracking-[0.18em] text-white/78">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <MusicStepper level={musicLevel} onChange={onMusicLevel} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Btn onClick={onResume} icon={<Play size={16} fill="currentColor" />}>
            Продолжить
          </Btn>
          <div className="flex gap-2">
            <Btn onClick={onRestart} variant="ghost" size="sm" icon={<RotateCcw size={14} />} className="flex-1">
              Заново
            </Btn>
            <Btn onClick={onToggleMute} variant="ghost" size="sm" icon={muted ? <VolumeX size={14} /> : <Volume2 size={14} />} className="flex-1">
              {muted ? 'Звук выкл' : 'Звук вкл'}
            </Btn>
          </div>
          <Btn onClick={onMenu} variant="quiet" size="sm" icon={<Home size={14} />}>
            Выйти в меню
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

// ---------------- Финал ----------------
export function GameOverScreen({
  result,
  save,
  isNewBest,
  sparksEarned,
  missionsDone,
  missions,
  canRevive,
  reviveLoading,
  canX2,
  x2Loading,
  x2Used,
  onRevive,
  onX2,
  onRetry,
  onMenu,
  onShop,
}: {
  result: GameResult;
  save: SaveData;
  isNewBest: boolean;
  sparksEarned: number;
  missionsDone: MissionDef[];
  missions: { def: MissionDef; p: number }[];
  canRevive: boolean;
  reviveLoading: boolean;
  canX2: boolean;
  x2Loading: boolean;
  x2Used: boolean;
  onRevive: () => void;
  onX2: () => void;
  onRetry: () => void;
  onMenu: () => void;
  onShop: () => void;
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 260);
    const t2 = setTimeout(() => setPhase(2), 620);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto scroll-thin pointer-events-auto bg-[radial-gradient(circle_at_50%_35%,rgba(255,47,116,0.16),rgba(4,3,12,0.93)_62%)] p-4 backdrop-blur-[3px] sm:p-6">
      <div className="grid w-full max-w-4xl gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel tone="ember" className={`transition-all duration-500 ${phase >= 0 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.4em] text-hot-300">
                свет погас
              </div>
              <div className="tnum mt-1 font-display text-[clamp(2.8rem,11vw,4.6rem)] font-black leading-[0.9] text-white">
                {result.score.toLocaleString('ru-RU')}
              </div>
            </div>
            {isNewBest && (
              <div className="animate-pop border border-ember-300/50 bg-ember-400/15 px-3 py-2 text-center text-ember-200" style={cut(8)}>
                <Trophy size={18} className="mx-auto" />
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em]">новый рекорд</div>
              </div>
            )}
          </div>
          <div className="mt-1 font-display text-[11px] uppercase tracking-[0.18em] text-white/78">
            лучший результат: <span className="text-white/95">{save.best.toLocaleString('ru-RU')}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { l: 'светлячков', v: result.orbs, i: <Sparkles size={14} />, c: 'text-ember-200' },
              { l: 'метров', v: result.distance, i: <ArrowRight size={14} />, c: 'text-sonar-300' },
              { l: 'впритирку', v: result.nearMiss, i: <Target size={14} />, c: 'text-white' },
              { l: 'бонусов', v: result.powerups, i: <Zap size={14} />, c: 'text-myst-300' },
              { l: 'поток', v: result.flowMax ? '×1.5' : '—', i: <Wind size={14} />, c: 'text-sonar-300' },
            ].map((s) => (
              <div key={s.l} className="border border-white/20 bg-ink-950/80 px-3 py-2.5" style={cut(8)}>
                <span className={s.c}>{s.i}</span>
                <div className="tnum mt-1 font-display text-lg font-bold leading-none">{s.v}</div>
                <div className="font-display text-[10px] uppercase tracking-[0.14em] text-white/78">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-white/78">
            Максимальное комбо в этом забеге: <span className="text-ember-300">×{Math.min(result.comboMax, 10)}</span>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel
            tone="sonar"
            className={`transition-all duration-500 ${phase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            title="Награда"
            icon={<Award size={13} />}
          >
            <div className="flex items-center gap-3">
              <Star size={26} className="text-ember-300" fill="currentColor" />
              <div>
                <div className="tnum font-display text-3xl font-black leading-none text-ember-200">+{sparksEarned}</div>
                <div className="font-display text-[11px] uppercase tracking-[0.2em] text-white/95">искр в кошелёк</div>
                {x2Used && <div className="mt-0.5 font-display text-[10px] uppercase tracking-[0.14em] text-sonar-300">×2 применено</div>}
              </div>
              <div className="ml-auto text-right">
                <div className="tnum font-display text-lg font-bold text-white/95">{save.sparks}</div>
                <div className="font-display text-[10px] uppercase tracking-[0.18em] text-white/78">баланс</div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              {missions.map(({ def, p }) => {
                const done = p >= def.target;
                const justDone = missionsDone.some((m) => m.id === def.id);
                return (
                  <div key={def.id}>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {justDone ? (
                        <span className="animate-pop font-display text-[11px] font-bold uppercase tracking-[0.14em] text-sonar-300">
                          задание выполнено +{def.reward}✦
                        </span>
                      ) : (
                        <span className={done ? 'text-sonar-300' : 'text-white/92'}>{def.label}</span>
                      )}
                      <span className="tnum ml-auto shrink-0 text-white/78">
                        {Math.min(p, def.target)}/{def.target}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Bar v={p / def.target} tone={done ? 'sonar' : 'myst'} thin />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <div
            className={`flex flex-col gap-2 transition-all duration-500 ${phase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            {canRevive && (
              <Btn onClick={onRevive} variant="reward" icon={<RotateCcw size={16} />} disabled={reviveLoading}>
                {reviveLoading ? 'Загрузка…' : 'Продолжить за рекламу'}
              </Btn>
            )}
            {canX2 && !x2Used && (
              <Btn onClick={onX2} variant="reward" size="sm" icon={<Video size={15} />} disabled={x2Loading}>
                {x2Loading ? 'Загрузка…' : 'Удвоить награду'}
              </Btn>
            )}
            <Btn onClick={onRetry} icon={<Play size={16} fill="currentColor" />}>
              Ещё забег
            </Btn>
            <div className="flex gap-2">
              <Btn onClick={onShop} variant="ghost" size="sm" icon={<ShoppingBag size={14} />} className="flex-1">
                В магазин
              </Btn>
              <Btn onClick={onMenu} variant="ghost" size="sm" icon={<Home size={14} />} className="flex-1">
                В меню
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// ---------------- Лидерборд ----------------
export interface LbRow {
  name: string;
  score: number;
  isMe: boolean;
}

export function LeaderboardOverlay({
  rows,
  myScore,
  fallback,
  onClose,
}: {
  rows: LbRow[];
  myScore: number | null;
  fallback: SaveData;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-ink-950/88 p-4 backdrop-blur-md">
      <div className="pointer-events-auto w-full max-w-md" onClick={(e) => e.stopPropagation()}>
      <Panel tone="ember" className="max-h-[88vh] overflow-y-auto scroll-thin" title="Лидеры тоннеля" icon={<Trophy size={13} />}>
        {rows.length === 0 ? (
          <div className="py-2">
            <div className="text-[12px] leading-relaxed text-white/88">
              Таблица лидеров появится после публикации игры (в консоли разработчика создайте лидерборд с именем{' '}
              <code className="text-ember-300">lumenScore</code>). Пока показываем твои последние забеги.
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {fallback.history.length === 0 && <div className="text-[12px] text-white/95">Забегов ещё не было — начни с LUMEN.</div>}
              {fallback.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/8 py-1.5 text-[13px]">
                  <span className="text-white/90">забег #{fallback.history.length - i}</span>
                  <span className="tnum font-display font-bold text-ember-200">{h.score.toLocaleString('ru-RU')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 border-b py-2 ${
                  r.isMe ? 'border-sonar-400/30 bg-sonar-500/10 px-2' : 'border-white/8'
                }`}
              >
                <span
                  className={`tnum w-7 shrink-0 font-display text-sm font-black ${
                    i === 0 ? 'text-ember-300' : i === 1 ? 'text-white/95' : i === 2 ? 'text-hot-300' : 'text-white/95'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${r.isMe ? 'text-sonar-200' : 'text-white/95'}`}>
                  {r.name}
                  {r.isMe && <span className="ml-2 font-display text-[10px] uppercase tracking-[0.18em] text-sonar-300">ты</span>}
                </span>
                <span className="tnum shrink-0 font-display text-sm font-bold text-ember-200">{r.score.toLocaleString('ru-RU')}</span>
              </div>
            ))}
            {myScore != null && (
              <div className="mt-3 flex items-center justify-between text-[11px] text-white/95">
                <span className="font-display uppercase tracking-[0.18em]">твой счёт</span>
                <span className="tnum font-display font-bold text-white">{myScore.toLocaleString('ru-RU')}</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <Btn onClick={onClose} variant="ghost" size="sm" className="w-full">
            Закрыть
          </Btn>
        </div>
      </Panel>
      </div>
    </div>
  );
}

// ---------------- Тосты наград ----------------
export function Toasts({ items }: { items: { id: number; text: string; tone: 'ember' | 'sonar' | 'myst' }[] }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-rise border px-3.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur ${
            t.tone === 'ember'
              ? 'border-ember-300/45 bg-ember-400/15 text-ember-200'
              : t.tone === 'sonar'
                ? 'border-sonar-400/45 bg-sonar-500/15 text-sonar-200'
                : 'border-myst-400/45 bg-myst-500/20 text-myst-300'
          }`}
          style={cut(8)}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
