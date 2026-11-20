import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Compass, Hand, Lock, Move3d, Orbit, RotateCcw, Sparkles, Star, Wind } from 'lucide-react';
import { THEMES, type Theme } from '../game/economy';
import { getThemePreviewUrl } from '../game/Engine';
import { getSkinPreviewUrl } from '../game/sparkSkins';
import { SKINS, type SaveData, type Skin } from '../game/state';
import { SkinViewer3D, TunnelViewer3D, type TunnelMode } from '../game/viewer';
import { Btn, cut, toHex } from './ui';

export type InspectKind = 'skin' | 'theme';

const THEME_FEATURES: Record<string, string[]> = {
  pulse: ['Круглые рёбра с чёткими кольцами', 'Холодный синий свет', 'Умеренное свечение — лучшая читаемость трассы'],
  copper: ['Янтарные сегменты на тёмном металле', 'Тёплая палитра: препятствия холодные', 'Редкие световые метки в панелях'],
  polar: ['Сине-зелёный градиент глубины', 'Мягкое сияние и частицы в толще воды', 'Просторный ритм: рёбра встречаются редко'],
  current: ['Стеклянно-металлические рёбра', 'Бирюзовое свечение, 8 направляющих лучей', 'Плотные частицы подводного течения'],
  prism: ['Шестигранные рёбра', 'Кромка переливается: розовый ⇄ фиолетовый', 'Гранёные панели; препятствия — ледяные'],
  corona: ['Золотые сегменты на тёмной бронзе', 'Яркое ядро с лучами в конце тоннеля', 'Препятствия холодные — не сливаются со стенами'],
  crystal: ['Восьмигранные рёбра', 'Кристаллические панели с ледяными бликами', 'Контрастные тёмные промежутки между гранями'],
  zero: [
    'Обсидиановые плиты со скосом и глянцевым бликом',
    'Спектральная инкрустация-ромб в каждой плите',
    'Рёбра с переливающейся кромкой и двойными нитями на швах',
    'Сингулярность: белое ядро, лучи и кольцо аккреции',
  ],
};

const SHAPE_NOTE: Record<string, string> = {
  plasma: 'Плазменная корона',
  frost: 'Ледяная грань с морозным гало',
  quartz: 'Перламутровый кварц с туманностью внутри',
  ring: 'Двойная орбита со спутниками',
  flame: 'Вихрь пламени над лавовым ядром',
  pulsar: 'Спиральный диск и грозовые джеты',
  void: 'Рунический каркас и гравитационное кольцо',
  star: 'Кристаллическая корона звёздных лучей',
};

function skinPerks(s: Skin): string[] {
  const out: string[] = [];
  if (s.drainMult < 1) out.push(`Свет гаснет на ${Math.round((1 - s.drainMult) * 100)}% медленнее`);
  if (s.magnetDur !== 7) out.push(`Магнит держится ${s.magnetDur} с (вместо 7)`);
  if (s.orbLightMult > 1) out.push(`Светлячки дают +${Math.round((s.orbLightMult - 1) * 100)}% света`);
  if (s.absorbOnce) out.push('Первый удар не сбрасывает комбо');
  if (s.startShield) out.push('Старт забега со щитом');
  return out;
}

function Thumb({ kind, id, size }: { kind: InspectKind; id: string; size: number }) {
  if (kind === 'skin') {
    const s = SKINS.find((x) => x.id === id) ?? SKINS[0];
    return (
      <img
        src={getSkinPreviewUrl(id)}
        alt={s.name}
        width={size}
        height={size}
        draggable={false}
        className="block object-contain"
        style={{ width: size, height: size, filter: `drop-shadow(0 0 ${Math.round(size * 0.18)}px ${toHex(s.glow)}88)` }}
      />
    );
  }
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  return <img src={getThemePreviewUrl(id)} alt={t.name} draggable={false} className="block h-full w-full object-cover" />;
}

function Pill({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`pointer-events-auto flex items-center gap-1.5 border px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.1em] backdrop-blur-md transition ${
        active ? 'border-ember-300/60 bg-ember-400/20 text-ember-200' : 'border-white/20 bg-ink-950/70 text-white/80 hover:border-white/40 hover:text-white'
      }`}
      style={cut(7)}
    >
      {children}
    </button>
  );
}

export function Inspector({
  kind,
  id,
  save,
  onId,
  onClose,
  onBuy,
  onSelect,
}: {
  kind: InspectKind;
  id: string;
  save: SaveData;
  onId: (id: string) => void;
  onClose: () => void;
  onBuy: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewer3D | TunnelViewer3D | null>(null);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [mode, setMode] = useState<TunnelMode>('inside');
  const [flight, setFlight] = useState(true);
  const [spin, setSpin] = useState(true);

  const items: { id: string }[] = kind === 'skin' ? SKINS : THEMES;
  const index = Math.max(0, items.findIndex((x) => x.id === id));
  const skin = kind === 'skin' ? SKINS.find((s) => s.id === id) ?? SKINS[0] : null;
  const theme: Theme | null = kind === 'theme' ? THEMES.find((t) => t.id === id) ?? THEMES[0] : null;

  const price = skin ? skin.price : theme!.price;
  const name = skin ? skin.name : theme!.name;
  const desc = skin ? skin.desc : theme!.desc;
  const owned = skin ? save.owned.includes(skin.id) || skin.price === 0 : save.themes.includes(theme!.id) || theme!.price === 0;
  const active = skin ? save.skin === skin.id : save.theme === theme!.id;
  const accent = skin ? toHex(skin.glow) : theme!.accent;

  // Создаём viewer один раз на вид осмотра (canvas создаётся вручную — безопасно для StrictMode)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;cursor:grab;';
    host.appendChild(canvas);
    try {
      viewerRef.current = kind === 'skin' ? new SkinViewer3D(canvas, id) : new TunnelViewer3D(canvas, id, save.skin);
      setFailed(false);
    } catch (e) {
      console.warn('3D viewer failed', e);
      setFailed(true);
    }
    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Смена предмета
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (v instanceof SkinViewer3D) v.setSkin(id);
    else v.setTheme(id);
  }, [id, kind]);

  useEffect(() => {
    const v = viewerRef.current;
    if (v instanceof TunnelViewer3D) v.setMode(mode);
  }, [mode, kind]);
  useEffect(() => {
    const v = viewerRef.current;
    if (v instanceof TunnelViewer3D) v.setFlight(flight);
  }, [flight, kind]);
  useEffect(() => {
    const v = viewerRef.current;
    if (v) v.setAutoRotate(spin);
  }, [spin, kind, mode]);

  const go = (d: number) => onId(items[(index + d + items.length) % items.length].id);

  // Клавиатура: ← → переключают предметы, Esc — назад
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') go(-1);
      else if (e.code === 'ArrowRight') go(1);
      else if (e.code === 'Escape') onClose();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  });

  const features = useMemo(() => {
    if (skin) {
      const p = skinPerks(skin);
      return [SHAPE_NOTE[skin.shape] ?? 'Авторская форма', ...(p.length ? p : ['Без бонусов — чистый внешний вид'])];
    }
    return THEME_FEATURES[theme!.id] ?? [];
  }, [skin, theme]);

  const missing = Math.max(0, price - save.sparks);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col bg-ink-950 lg:flex-row" onClick={(e) => e.stopPropagation()}>
      {/* ---------- 3D-вьюпорт ---------- */}
      <div className="flex min-h-0 min-w-0 flex-[1.15_1_0%] flex-col lg:flex-[1_1_0%]">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden" onPointerDown={() => setTouched(true)}>
          <div ref={hostRef} className="absolute inset-0" />

          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900 p-6 text-center">
              <div className="flex h-40 w-full max-w-xs items-center justify-center overflow-hidden" style={cut(12)}>
                <Thumb kind={kind} id={id} size={150} />
              </div>
              <div className="text-[12px] text-white/75">3D-режим недоступен на этом устройстве (нет WebGL). Показано плоское превью.</div>
            </div>
          )}

          {/* верхняя панель */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-3.5">
            <button
              onClick={onClose}
              className="pointer-events-auto flex items-center gap-1.5 border border-white/25 bg-ink-950/75 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md transition hover:border-white/50 hover:text-white"
              style={cut(8)}
            >
              <ArrowLeft size={14} />
              <span>В магазин</span>
            </button>
            <div className="flex items-center gap-1.5 border border-white/20 bg-ink-950/70 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md" style={cut(8)}>
              <Move3d size={13} className="text-sonar-300" />
              3D · {index + 1}/{items.length}
            </div>
          </div>

          {/* стрелки */}
          {(['prev', 'next'] as const).map((side) => (
            <button
              key={side}
              onClick={() => go(side === 'prev' ? -1 : 1)}
              aria-label={side === 'prev' ? 'Предыдущий' : 'Следующий'}
              className={`pointer-events-auto absolute top-1/2 -translate-y-1/2 border border-white/20 bg-ink-950/65 p-2.5 text-white/85 backdrop-blur-md transition hover:border-white/50 hover:bg-ink-950/90 hover:text-white ${
                side === 'prev' ? 'left-2 sm:left-3' : 'right-2 sm:right-3'
              }`}
              style={cut(8)}
            >
              {side === 'prev' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          ))}

          {/* подсказка управления */}
          {!failed && (
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-14 flex justify-center transition-opacity duration-700 ${touched ? 'opacity-0' : 'opacity-100'}`}
            >
              <div className="flex items-center gap-2 border border-white/20 bg-ink-950/75 px-3.5 py-2 text-[11px] text-white/90 backdrop-blur-md" style={cut(8)}>
                <Hand size={14} className="animate-pulse text-ember-300" />
                {kind === 'theme' && mode === 'inside'
                  ? 'Тяните, чтобы осмотреться во все стороны'
                  : 'Тяните, чтобы вращать · колесо / щипок — приблизить'}
              </div>
            </div>
          )}

          {/* панель режимов */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2.5 sm:p-3.5">
            {kind === 'theme' && (
              <div className="pointer-events-auto flex gap-1">
                <Pill active={mode === 'inside'} onClick={() => setMode('inside')} title="Вид из кабины — как в игре">
                  <Compass size={13} /> Изнутри
                </Pill>
                <Pill active={mode === 'outside'} onClick={() => setMode('outside')} title="Разрез тоннеля снаружи">
                  <Orbit size={13} /> Снаружи
                </Pill>
              </div>
            )}
            {kind === 'theme' && mode === 'inside' ? (
              <Pill active={flight} onClick={() => setFlight((f) => !f)}>
                <Wind size={13} /> Полёт {flight ? 'вкл' : 'выкл'}
              </Pill>
            ) : (
              <Pill active={spin} onClick={() => setSpin((s) => !s)}>
                <Orbit size={13} /> Автовращение {spin ? 'вкл' : 'выкл'}
              </Pill>
            )}
            <Pill onClick={() => viewerRef.current?.resetView()}>
              <RotateCcw size={13} /> Сбросить вид
            </Pill>
          </div>
        </div>

        {/* лента предметов */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-white/12 bg-ink-950/90 p-2 scroll-thin">
          {items.map((it) => {
            const isOwned = kind === 'skin' ? save.owned.includes(it.id) || SKINS.find((s) => s.id === it.id)!.price === 0 : save.themes.includes(it.id) || THEMES.find((t) => t.id === it.id)!.price === 0;
            const cur = it.id === id;
            return (
              <button
                key={it.id}
                onClick={() => onId(it.id)}
                aria-label={'name' in it ? String((it as { name: string }).name) : it.id}
                className={`relative flex shrink-0 items-center justify-center overflow-hidden border transition ${
                  cur ? 'border-ember-300/80 bg-ember-400/15' : 'border-white/15 bg-white/[0.04] opacity-75 hover:border-white/40 hover:opacity-100'
                }`}
                style={{ ...cut(7), width: kind === 'skin' ? 56 : 84, height: kind === 'skin' ? 56 : 54 }}
              >
                <Thumb kind={kind} id={it.id} size={46} />
                {!isOwned && (
                  <span className="absolute right-0.5 top-0.5 rounded-sm bg-ink-950/80 p-[3px] text-ember-300">
                    <Lock size={9} />
                  </span>
                )}
                {kind === 'theme' && save.theme === it.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sonar-400" />}
                {kind === 'skin' && save.skin === it.id && <span className="absolute inset-x-2 bottom-0.5 h-0.5 bg-sonar-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Информация ---------- */}
      <aside className="flex max-h-[46%] min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-t border-white/12 bg-ink-900/95 p-4 scroll-thin lg:max-h-none lg:w-[330px] lg:border-l lg:border-t-0 lg:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {price === 0 ? (
              <span className="border border-sonar-400/40 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-[0.14em] text-sonar-300">бесплатно</span>
            ) : (
              <span className="border border-ember-300/45 bg-ember-400/10 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-[0.14em] text-ember-200">
                {kind === 'skin' ? 'авторский скин' : 'премиум-тоннель'}
              </span>
            )}
            {active && <span className="font-display text-[10px] uppercase tracking-[0.16em] text-sonar-300">· {kind === 'skin' ? 'надет' : 'активен'}</span>}
          </div>
          <h2 className="mt-2 font-display text-xl font-black uppercase leading-tight tracking-[0.02em]" style={{ textShadow: `0 0 22px ${accent}66` }}>
            {name}
          </h2>
          <div className="mt-1 h-px w-16" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-white/85">{desc}</p>
        </div>

        <div>
          <div className="mb-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{kind === 'skin' ? 'Особенности' : 'Что в тоннеле'}</div>
          <ul className="flex flex-col gap-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-white/88">
                <Sparkles size={12} className="mt-[3px] shrink-0" style={{ color: accent }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {kind === 'theme' && (
          <div className="border border-white/12 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-white/72" style={cut(8)}>
            <b className="text-white/90">Изнутри</b> — вид из кабины, как на трассе: тяните, чтобы оглядеться. <b className="text-white/90">Снаружи</b> — разрез
            тоннеля: вращайте и приближайте, чтобы рассмотреть рёбра и обшивку.
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {owned ? (
            <Btn
              size="md"
              variant={active ? 'quiet' : 'primary'}
              onClick={() => !active && onSelect(id)}
              icon={active ? <Check size={16} /> : <Sparkles size={16} />}
              className="w-full"
            >
              {active ? (kind === 'skin' ? 'Надет' : 'Активен') : kind === 'skin' ? 'Надеть' : 'Применить'}
            </Btn>
          ) : (
            <>
              <Btn
                size="md"
                variant={missing === 0 ? 'primary' : 'ghost'}
                onClick={() => onBuy(id)}
                disabled={missing > 0}
                icon={<Star size={16} />}
                className="w-full"
              >
                Купить · {price} ✦
              </Btn>
              <div className="text-center text-[11px] text-white/65">
                {missing > 0 ? `Не хватает ${missing} ✦ — копите в забегах или пополните в разделе «Искры»` : `У вас ${save.sparks.toLocaleString('ru-RU')} ✦`}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
