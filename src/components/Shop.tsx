import { useState } from 'react';
import { BatteryCharging, BellOff, Box, Check, Coins, Crown, Flame, FlaskConical, Gem, Gift, Lock, Magnet, Palette, Shield, ShieldCheck, ShoppingCart, Sparkles, Star, Trophy, Video, X } from 'lucide-react';
import { BUFFS, PRODUCTS, THEMES, type Product } from '../game/economy';
import { getThemePreviewUrl } from '../game/Engine';
import { getSkinPreviewUrl } from '../game/sparkSkins';
import { SKINS, achievementProgress, type SaveData } from '../game/state';
import { Bar, Btn, cut, toHex } from './ui';
import { Inspector, type InspectKind } from './Inspector';

type Tab = 'sparks' | 'skins' | 'themes' | 'buffs' | 'ach';

/** Тоннель: вложенные арки, уходящие вглубь. */
function TunnelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V11a9 9 0 0 1 18 0v10" />
      <path d="M7 21v-9a5 5 0 0 1 10 0v9" />
      <path d="M10.5 21v-8a1.5 1.5 0 0 1 3 0v8" />
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'sparks', label: 'Магазин', icon: <ShoppingCart size={16} /> },
  { id: 'skins', label: 'Скины', icon: <Palette size={16} /> },
  { id: 'themes', label: 'Тоннели', icon: <TunnelIcon size={16} /> },
  { id: 'buffs', label: 'Баффы', icon: <FlaskConical size={16} /> },
  { id: 'ach', label: 'Награды', icon: <Trophy size={16} /> },
];

const BUFF_ICONS: Record<string, React.ReactNode> = {
  shield: <Shield size={18} />,
  magnet: <Magnet size={18} />,
  cells: <BatteryCharging size={18} />,
  warden: <ShieldCheck size={18} />,
  charm: <Gem size={18} />,
};

/** Общий размер превью в карточках «Скины» и «Тоннели» — сетка одинаковая. */
const PV_W = 116;
const PV_H = 76;

function SkinPreview({ id }: { id: string }) {
  const s = SKINS.find((x) => x.id === id) ?? SKINS[0];
  const src = getSkinPreviewUrl(s.id);
  const hex = toHex(s.glow);
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden border"
      style={{
        width: PV_W,
        height: PV_H,
        ...cut(10),
        borderColor: `${hex}55`,
        background: `radial-gradient(circle at 50% 50%, ${hex}30 0%, rgba(8,7,24,0.9) 72%)`,
        boxShadow: 'inset 0 0 16px rgba(0,0,0,0.6)',
      }}
    >
      <img
        src={src}
        alt={s.name}
        width={60}
        height={60}
        className="block object-contain"
        style={{ width: 60, height: 60, filter: `drop-shadow(0 0 ${Math.round(60 * 0.22)}px ${hex}88)` }}
        draggable={false}
      />
    </div>
  );
}

function ThemePreview({ t }: { t: (typeof THEMES)[number] }) {
  const src = getThemePreviewUrl(t.id);
  const paid = t.price > 0;
  return (
    <div
      className="relative shrink-0 overflow-hidden border"
      style={{
        width: PV_W,
        height: PV_H,
        ...cut(10),
        borderColor: paid ? `${t.accent}66` : 'rgba(255,255,255,0.16)',
        boxShadow: paid
          ? `inset 0 0 18px rgba(0,0,0,0.65), 0 0 22px -4px ${toHex(t.nebula)}88`
          : `inset 0 0 14px rgba(0,0,0,0.65)`,
      }}
    >
      <img src={src} alt={t.name} width={PV_W} height={PV_H} className="block h-full w-full object-cover" draggable={false} />
      {paid && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }}
        />
      )}
    </div>
  );
}

/** Превью-карточка: плашка «3D» всегда видна, при наведении по центру появляется белый кубик. */
function View3DFrame({ onOpen, children, label }: { onOpen: () => void; children: React.ReactNode; label: string }) {
  return (
    <button onClick={onOpen} aria-label={label} title="Открыть 3D-осмотр" className="group relative shrink-0 cursor-pointer self-start">
      {children}
      {/* затемнение + кубик по центру при наведении */}
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/0 opacity-0 transition duration-150 group-hover:bg-ink-950/50 group-hover:opacity-100"
        style={cut(10)}
      >
        <Box size={26} strokeWidth={1.8} className="cube-hover text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]" />
      </span>
      {/* плашка 3D */}
      <span
        className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1 border border-sonar-400/70 bg-ink-950/90 px-1.5 py-[3px] font-display text-[9px] font-black leading-none tracking-[0.12em] text-sonar-300 shadow-[0_0_10px_-2px_rgba(35,224,182,0.55)] transition group-hover:border-sonar-300 group-hover:text-sonar-200"
        style={cut(4)}
      >
        <Box size={10} strokeWidth={2.2} />3D
      </span>
    </button>
  );
}

/** Единая карточка для «Скинов» и «Тоннелей»: одинаковые размеры и сетка. */
function ItemCard({
  tone,
  preview,
  title,
  tags,
  desc,
  actions,
}: {
  tone: 'active' | 'paid' | 'plain';
  preview: React.ReactNode;
  title: string;
  tags: React.ReactNode;
  desc: string;
  actions: React.ReactNode;
}) {
  const border =
    tone === 'active'
      ? 'border-sonar-400/65 bg-sonar-500/12'
      : tone === 'paid'
        ? 'border-ember-300/25 bg-white/[0.04] hover:border-ember-300/50'
        : 'border-white/12 bg-white/[0.03] hover:border-white/30';
  return (
    <div className={`grid min-h-[158px] grid-cols-[116px_minmax(0,1fr)] gap-3 border p-3 transition ${border}`} style={cut(12)}>
      {preview}
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-[13px] font-bold uppercase tracking-[0.04em]">{title}</span>
          {tags}
        </div>
        <div className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-white/80">{desc}</div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">{actions}</div>
      </div>
    </div>
  );
}

const BASE_RATE = 600 / 69; // ✦ за рубль у самой маленькой пачки

function PackCard({
  p,
  price,
  paymentsOn,
  pending,
  onBuy,
}: {
  p: Product;
  price: string;
  paymentsOn: boolean;
  pending: boolean;
  onBuy: () => void;
}) {
  const bonus = p.sparks ? Math.round((p.sparks / p.rub / BASE_RATE - 1) * 100) : 0;
  const tier = p.tier;
  const Icon =
    p.kind === 'noads' ? BellOff : p.kind === 'bundle' ? Gift : (p.sparks ?? 0) >= 9000 ? Crown : (p.sparks ?? 0) >= 4000 ? Gem : (p.sparks ?? 0) >= 1500 ? Sparkles : Coins;

  const palette = {
    starter: { grad: 'linear-gradient(110deg,#23e0b6,#6ef7d8,#8b62ff,#23e0b6)', inner: 'linear-gradient(135deg, rgba(35,224,182,0.20), rgba(8,7,24,0.96) 70%)', chip: 'from-sonar-400 to-sonar-300 text-ink-950', label: 'Для новичков', icon: 'text-sonar-300' },
    good: { grad: 'linear-gradient(110deg,#ffb03a,#ffe9b8,#f2820f,#ffb03a)', inner: 'linear-gradient(135deg, rgba(255,176,58,0.22), rgba(8,7,24,0.96) 70%)', chip: 'from-ember-400 to-ember-300 text-ink-950', label: 'Выгодно', icon: 'text-ember-300' },
    best: { grad: 'linear-gradient(110deg,#ff7ad9,#ffd166,#8b62ff,#6ef7d8,#ff7ad9)', inner: 'linear-gradient(135deg, rgba(139,98,255,0.28), rgba(255,176,58,0.12) 45%, rgba(8,7,24,0.96) 85%)', chip: 'from-ember-300 via-ember-200 to-myst-300 text-ink-950', label: 'Лучшая цена', icon: 'text-ember-200' },
  }[tier ?? 'good'];

  // Ярлык («Для новичков», «Выгодно», «Лучшая цена») набран тем же шрифтом, что и название покупки
  // (font-display, bold, uppercase) — отдельной строкой сверху, поэтому не накладывается на кнопку.
  const chip = tier ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-block max-w-full bg-gradient-to-r px-2.5 py-[3px] font-display text-[12px] font-bold uppercase leading-tight tracking-[0.04em] [text-shadow:none] ${palette.chip}`}
        style={cut(4)}
      >
        {palette.label}
      </span>
      {bonus > 0 && tier !== 'starter' && (
        <span className="inline-block border border-white/35 bg-white/10 px-2 py-[2px] font-display text-[12px] font-bold uppercase leading-tight tracking-[0.04em] text-white">
          +{bonus}% искр
        </span>
      )}
    </div>
  ) : null;

  // ---- Обычная покупка: спокойная, компактная ----
  if (!tier) {
    return (
      <div className="border border-white/14 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-white/30" style={cut(12)}>
        <div className="flex h-full min-w-0 items-center gap-3 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/14 bg-white/[0.05] text-white/75" style={cut(8)}>
            <Icon size={20} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold uppercase leading-tight tracking-[0.04em] [overflow-wrap:anywhere]">{p.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] leading-snug text-white/80">
              <span>{p.note}</span>
              {bonus > 0 && <span className="font-display text-[10px] font-bold text-sonar-300">+{bonus}%</span>}
            </div>
          </div>
          <Btn size="sm" onClick={onBuy} disabled={pending} variant={paymentsOn ? 'primary' : 'ghost'} icon={<Star size={13} />} className="shrink-0 px-4!">
            {pending ? 'Покупка…' : price}
          </Btn>
        </div>
      </div>
    );
  }

  // ---- Выгодное предложение: крупная акцентная карточка с бегущей рамкой и свечением ----
  const glow = { starter: 'rgba(35,224,182,0.55)', good: 'rgba(255,176,58,0.55)', best: 'rgba(139,98,255,0.7)' }[tier];
  return (
    <div className="offer-glow transition hover:-translate-y-0.5" style={{ ['--glow' as string]: glow }}>
      <div className="offer-flow p-[2px]" style={{ ...cut(16), background: palette.grad, backgroundSize: '300% 100%' }}>
        <div className="offer-sheen relative flex flex-col gap-3 overflow-hidden p-4" style={{ ...cut(14), background: palette.inner }}>
          {chip}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center border border-white/30 bg-white/10 ${palette.icon}`} style={cut(10)}>
                <Icon size={30} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-black uppercase leading-tight tracking-[0.04em] text-white [overflow-wrap:anywhere] sm:text-lg">{p.title}</div>
                <div className="mt-1 text-[13px] leading-snug text-white/90">{p.note}</div>
              </div>
            </div>
            <Btn size="md" onClick={onBuy} disabled={pending} variant={paymentsOn ? 'primary' : 'ghost'} icon={<Star size={14} />} className="w-full shrink-0 sm:w-auto">
              {pending ? 'Покупка…' : price}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Shop({
  save,
  storePrices,
  paymentsOn,
  pendingSku,
  adCooldown,
  tab,
  onTab,
  onBuyProduct,
  onWatchForSparks,
  onBuySkin,
  onSelectSkin,
  onBuyTheme,
  onSelectTheme,
  onBuyBuff,
  onToggleLoadout,
  onClose,
}: {
  save: SaveData;
  storePrices: Record<string, string>;
  paymentsOn: boolean;
  pendingSku: string | null;
  adCooldown: number;
  tab: Tab;
  onTab: (t: Tab) => void;
  onBuyProduct: (p: Product) => void;
  onWatchForSparks: () => void;
  onBuySkin: (id: string) => void;
  onSelectSkin: (id: string) => void;
  onBuyTheme: (id: string) => void;
  onSelectTheme: (id: string) => void;
  onBuyBuff: (id: string) => void;
  onToggleLoadout: (id: string) => void;
  onClose: () => void;
}) {
  const [inspect, setInspect] = useState<{ kind: InspectKind; id: string } | null>(null);
  const open3D = (kind: InspectKind, id: string) => setInspect({ kind, id });
  return (
    <div onClick={onClose} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-ink-950/92 p-0 backdrop-blur-md sm:p-5 short:p-0">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative grid h-full max-h-full min-h-0 w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden wide:grid-rows-[auto_minmax(0,1fr)]"
        style={{ ...cut(18), background: 'rgba(8,7,24,0.97)' }}
      >
        {/* ---- Верхняя шапка магазина (баланс, реклама и крестик в одном ряду без наложения) ---- */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-white/12 bg-ink-950/85 px-3 py-2 sm:px-5 sm:py-2.5">
          <div className="order-1 flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-ember-300">Магазин</span>
            <div className="flex items-center gap-1.5 border border-ember-300/35 bg-ember-400/12 px-2.5 py-1 sm:px-3 sm:py-1.5" style={cut(8)}>
              <Star size={14} fill="currentColor" className="text-ember-300" />
              <span className="tnum font-display text-sm font-bold text-ember-200">{save.sparks.toLocaleString('ru-RU')}</span>
              <span className="font-display text-[10px] uppercase tracking-[0.16em] text-ember-200/80">✦ искр</span>
            </div>
          </div>

          {/* крестик всегда в первой строке справа — на телефоне его нельзя вытеснить */}
          <button
            onClick={onClose}
            className="order-2 ml-auto shrink-0 border border-white/25 bg-white/[0.1] p-2.5 text-white transition hover:border-white/45 hover:bg-white/20 sm:order-3 sm:ml-0 sm:p-2"
            style={cut(8)}
            aria-label="Закрыть магазин"
          >
            <X size={18} />
          </button>

          <button
            onClick={onWatchForSparks}
            disabled={adCooldown > 0}
            className="pointer-events-auto order-3 flex w-full items-center justify-center gap-2 border border-myst-400/45 bg-myst-500/18 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.11em] text-myst-200 transition hover:border-myst-300/70 hover:bg-myst-500/30 disabled:opacity-45 sm:order-2 sm:ml-auto sm:w-auto"
            style={cut(8)}
          >
            {adCooldown > 0 ? (
              <>
                <Lock size={13} className="shrink-0" />
                <span>ещё {Math.ceil(adCooldown / 1000)} с · реклама</span>
              </>
            ) : (
              <>
                <Video size={14} className="shrink-0 text-sonar-300" />
                <span>+70✦ за просмотр рекламы</span>
              </>
            )}
          </button>
        </div>

        {/* ---- Основная область: левое меню вкладок + контент ---- */}
        <div className="contents wide:grid wide:min-h-0 wide:grid-cols-[176px_minmax(0,1fr)] wide:overflow-hidden">
          {/* ---- левый рельс ---- */}
          <div className="flex items-center gap-2 border-b border-white/12 bg-ink-950/70 p-2 sm:p-3 wide:flex-col wide:items-stretch wide:overflow-y-auto wide:border-b-0 wide:border-r">
            <div className="grid w-full grid-cols-5 gap-1 sm:gap-1.5 wide:flex wide:flex-col">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTab(t.id)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 border px-0.5 py-1.5 font-display text-[9px] font-bold uppercase tracking-[0.04em] transition-all sm:text-[10px] wide:flex-row wide:justify-start wide:gap-2 wide:px-2.5 wide:py-2 wide:tracking-[0.12em] ${
                    tab === t.id
                      ? 'border-ember-300/55 bg-ember-400/15 text-ember-200'
                      : 'border-white/12 text-white/60 hover:border-white/30 hover:bg-white/5 hover:text-white'
                  }`}
                  style={cut(8)}
                >
                  {t.icon}
                  <span className="max-w-full truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ---- контент ---- */}
          <div className="min-h-0 overflow-y-auto overscroll-contain scroll-thin p-3 sm:p-5" style={{ touchAction: 'pan-y' }}>
            {tab === 'sparks' && (
              <div className="flex flex-col gap-5">
                {/* ---- Выгодные предложения: отдельный выделенный блок ---- */}
                <section
                  className="relative border border-ember-300/45 p-3 sm:p-4"
                  style={{
                    ...cut(18),
                    background: 'radial-gradient(120% 90% at 50% 0%, rgba(255,176,58,0.16), rgba(139,98,255,0.08) 55%, rgba(8,7,24,0.6) 100%)',
                    boxShadow: 'inset 0 0 40px -12px rgba(255,176,58,0.35)',
                  }}
                >
                  <div className="mb-3 flex items-start gap-2.5">
                    <Flame size={22} className="mt-0.5 shrink-0 text-ember-300" />
                    <div className="min-w-0">
                      <div className="font-display text-sm font-black uppercase leading-tight tracking-[0.12em] text-ember-200 sm:text-base">Выгодные предложения</div>
                      <div className="mt-0.5 text-[12px] leading-snug text-white/85">Больше искр за те же деньги. Новичкам — начать с первого набора.</div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {PRODUCTS.filter((p) => p.tier)
                      .sort((x, y) => x.rub - y.rub)
                      .map((p) => (
                        <PackCard key={p.id} p={p} price={storePrices[p.id] ?? p.price} paymentsOn={paymentsOn} pending={pendingSku === p.id} onBuy={() => onBuyProduct(p)} />
                      ))}
                  </div>
                </section>

                {/* ---- Обычные покупки ---- */}
                <section>
                  <div className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Обычные покупки</div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {PRODUCTS.filter((p) => !p.tier)
                      .sort((x, y) => x.rub - y.rub)
                      .map((p) => (
                        <PackCard key={p.id} p={p} price={storePrices[p.id] ?? p.price} paymentsOn={paymentsOn} pending={pendingSku === p.id} onBuy={() => onBuyProduct(p)} />
                      ))}
                  </div>
                </section>
              </div>
            )}

            {tab === 'skins' && (
              <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2">
                {SKINS.map((sk) => {
                  const owned = save.owned.includes(sk.id) || sk.price === 0;
                  const active = save.skin === sk.id;
                  return (
                    <ItemCard
                      key={sk.id}
                      tone={active ? 'active' : 'plain'}
                      preview={
                        <View3DFrame onOpen={() => open3D('skin', sk.id)} label={`3D-осмотр: ${sk.name}`}>
                          <SkinPreview id={sk.id} />
                        </View3DFrame>
                      }
                      title={sk.name}
                      tags={
                        <>
                          {sk.price === 0 ? (
                            <span className="border border-sonar-400/35 px-1 font-display text-[9px] uppercase tracking-[0.14em] text-sonar-300">бесплатно</span>
                          ) : !owned ? (
                            <span className="border border-ember-300/40 px-1 font-display text-[9px] uppercase tracking-[0.14em] text-ember-300">авторский</span>
                          ) : null}
                          {active && <span className="font-display text-[10px] uppercase tracking-[0.16em] text-sonar-300">· надет</span>}
                        </>
                      }
                      desc={sk.desc}
                      actions={
                        owned ? (
                          <Btn size="sm" variant={active ? 'quiet' : 'ghost'} onClick={() => onSelectSkin(sk.id)} icon={active ? <Check size={12} /> : <Sparkles size={12} />}>
                            {active ? 'Активен' : 'Надеть'}
                          </Btn>
                        ) : (
                          <Btn size="sm" variant={save.sparks >= sk.price ? 'primary' : 'ghost'} onClick={() => onBuySkin(sk.id)} disabled={save.sparks < sk.price} icon={<Star size={12} />}>
                            {sk.price} ✦
                          </Btn>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}

            {tab === 'themes' && (
              <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2">
                {THEMES.map((t) => {
                  const owned = save.themes.includes(t.id) || t.price === 0;
                  const active = save.theme === t.id;
                  const can = owned || save.sparks >= t.price;
                  const paid = t.price > 0;
                  return (
                    <ItemCard
                      key={t.id}
                      tone={active ? 'active' : paid ? 'paid' : 'plain'}
                      preview={
                        <View3DFrame onOpen={() => open3D('theme', t.id)} label={`3D-осмотр: ${t.name}`}>
                          <ThemePreview t={t} />
                        </View3DFrame>
                      }
                      title={t.name}
                      tags={
                        <>
                          {t.price === 0 ? (
                            <span className="border border-sonar-400/35 px-1 font-display text-[9px] uppercase tracking-[0.14em] text-sonar-300">бесплатно</span>
                          ) : !owned ? (
                            <span className="border border-ember-300/45 bg-ember-400/10 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-[0.14em] text-ember-200">Новая архитектура</span>
                          ) : null}
                          {active && <span className="font-display text-[10px] uppercase tracking-[0.16em] text-sonar-300">· активен</span>}
                        </>
                      }
                      desc={t.desc}
                      actions={
                        owned ? (
                          <Btn size="sm" variant={active ? 'quiet' : 'ghost'} onClick={() => onSelectTheme(t.id)} icon={active ? <Check size={12} /> : <Sparkles size={12} />}>
                            {active ? 'Активен' : 'Применить'}
                          </Btn>
                        ) : (
                          <Btn size="sm" variant={can ? 'primary' : 'ghost'} onClick={() => onBuyTheme(t.id)} disabled={!can} icon={<Star size={12} />}>
                            {t.price} ✦
                          </Btn>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}

            {tab === 'buffs' && (
              <div className="flex flex-col gap-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/80">
                  <span className="font-display uppercase tracking-[0.16em]">Слоты на забег: {save.loadout.length}/2</span>
                  <span>Расходуются при старте</span>
                </div>
                {BUFFS.map((b) => {
                  const have = save.buffs[b.id] ?? 0;
                  const on = save.loadout.includes(b.id);
                  const icon = BUFF_ICONS[b.id] ?? <FlaskConical size={18} />;
                  return (
                    <div key={b.id} className={`flex items-center gap-3 border px-3 py-2.5 ${on ? 'border-ember-300/50 bg-ember-400/10' : 'border-white/12 bg-white/[0.03]'}`} style={cut(10)}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-ember-300/30 bg-ember-400/10 text-ember-300" style={cut(7)}>{icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[13px] font-bold uppercase tracking-[0.04em]">
                          {b.name}
                          {have > 0 && <span className="ml-2 text-[11px] text-white/70">×{have}</span>}
                        </div>
                        <div className="text-[11px] text-white/78">{b.desc}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {have > 0 && (
                          <Btn size="sm" variant={on ? 'quiet' : 'ghost'} onClick={() => onToggleLoadout(b.id)}>
                            {on ? 'Снять' : 'Взять'}
                          </Btn>
                        )}
                        <Btn size="sm" variant={save.sparks >= b.price ? 'primary' : 'ghost'} onClick={() => onBuyBuff(b.id)} disabled={save.sparks < b.price}>
                          {b.price} ✦
                        </Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'ach' && (
              <div className="grid gap-2 sm:grid-cols-2">
                {achievementProgress(save).map((a) => (
                  <div key={a.name} className={`border p-3 ${a.done ? 'border-sonar-400/45 bg-sonar-500/10' : 'border-white/12 bg-white/[0.03]'}`} style={cut(10)}>
                    <div className="flex items-center gap-2">
                      <span className={a.done ? 'text-sonar-300' : 'text-white/55'}>{a.done ? <Check size={14} /> : <Trophy size={14} />}</span>
                      <span className="font-display text-[12px] font-bold uppercase tracking-[0.06em]">{a.name}</span>
                      <span className="ml-auto text-[10px] text-ember-200">+{a.sparks}✦</span>
                    </div>
                    <div className="mt-1 text-[11px] text-white/78">{a.desc}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Bar v={a.p / a.target} tone={a.done ? 'sonar' : 'myst'} thin />
                      <span className="tnum shrink-0 text-[10px] text-white/70">
                        {a.p}/{a.target}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {inspect && (
          <Inspector
            kind={inspect.kind}
            id={inspect.id}
            save={save}
            onId={(id) => setInspect({ kind: inspect.kind, id })}
            onClose={() => setInspect(null)}
            onBuy={(id) => (inspect.kind === 'skin' ? onBuySkin(id) : onBuyTheme(id))}
            onSelect={(id) => (inspect.kind === 'skin' ? onSelectSkin(id) : onSelectTheme(id))}
          />
        )}
      </div>
    </div>
  );
}
