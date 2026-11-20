import { useState } from 'react';
import { Award, Box, Check, Lock, ShoppingBag, Sparkles, Star, Video, X, Zap } from 'lucide-react';
import { BUFFS, PRODUCTS, THEMES, type Product } from '../game/economy';
import { getThemePreviewUrl } from '../game/Engine';
import { getSkinPreviewUrl } from '../game/sparkSkins';
import { SKINS, achievementProgress, type SaveData } from '../game/state';
import { Bar, Btn, cut, toHex } from './ui';
import { Inspector, type InspectKind } from './Inspector';

type Tab = 'sparks' | 'skins' | 'themes' | 'buffs' | 'ach';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'sparks', label: 'Искры', icon: <Star size={15} /> },
  { id: 'skins', label: 'Скины', icon: <Sparkles size={15} /> },
  { id: 'themes', label: 'Тоннели', icon: <ShoppingBag size={15} /> },
  { id: 'buffs', label: 'Баффы', icon: <Zap size={15} /> },
  { id: 'ach', label: 'Награды', icon: <Award size={15} /> },
];

function SkinSwatch({ id, size = 54 }: { id: string; size?: number }) {
  const s = SKINS.find((x) => x.id === id) ?? SKINS[0];
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const src = getSkinPreviewUrl(s.id);
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 ${Math.round(size * 0.22)}px ${hex(s.glow)}88)`,
      }}
    >
      <img src={src} alt={s.name} width={size} height={size} className="block h-full w-full object-contain" draggable={false} />
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
        width: 116,
        height: 76,
        ...cut(10),
        borderColor: paid ? `${t.accent}66` : 'rgba(255,255,255,0.16)',
        boxShadow: paid
          ? `inset 0 0 18px rgba(0,0,0,0.65), 0 0 22px -4px ${toHex(t.nebula)}88`
          : `inset 0 0 14px rgba(0,0,0,0.65)`,
      }}
    >
      <img src={src} alt={t.name} width={116} height={76} className="block h-full w-full object-cover" draggable={false} />
      {paid && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }}
        />
      )}
    </div>
  );
}

/** Превью-карточка с бейджем «3D»: клик открывает осмотр. */
function View3DFrame({ onOpen, children, label }: { onOpen: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onOpen}
      aria-label={label}
      title="Открыть 3D-осмотр"
      className="group relative shrink-0 cursor-pointer self-start"
    >
      {children}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/0 opacity-0 transition group-hover:bg-ink-950/45 group-hover:opacity-100">
        <Box size={22} className="text-white drop-shadow" />
      </span>
      <span className="pointer-events-none absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-sm bg-ink-950/85 px-1 py-px font-display text-[8px] font-black tracking-[0.1em] text-sonar-300">
        <Box size={8} />3D
      </span>
    </button>
  );
}

function Open3D({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap border border-sonar-400/40 bg-sonar-500/10 px-2.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-sonar-200 transition hover:border-sonar-300/70 hover:bg-sonar-500/20"
      style={cut(8)}
    >
      <Box size={13} />
      3D
    </button>
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
    <div onClick={onClose} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-ink-950/92 p-2 backdrop-blur-md sm:p-5">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative grid h-full max-h-[94vh] w-full max-w-5xl grid-rows-[auto_auto_1fr] overflow-hidden lg:grid-rows-[auto_1fr]"
        style={{ ...cut(18), background: 'rgba(8,7,24,0.97)' }}
      >
        {/* ---- Верхняя шапка магазина (баланс, реклама и крестик в одном ряду без наложения) ---- */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/12 bg-ink-950/85 px-3.5 py-2.5 sm:px-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-ember-300">
              Магазин
            </span>
            <div className="flex items-center gap-1.5 border border-ember-300/35 bg-ember-400/12 px-2.5 py-1 sm:px-3 sm:py-1.5" style={cut(8)}>
              <Star size={14} fill="currentColor" className="text-ember-300" />
              <span className="tnum font-display text-sm font-bold text-ember-200">{save.sparks.toLocaleString('ru-RU')}</span>
              <span className="font-display text-[10px] uppercase tracking-[0.16em] text-ember-200/80">✦ искр</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={onWatchForSparks}
              disabled={adCooldown > 0}
              className="pointer-events-auto flex items-center gap-2 border border-myst-400/45 bg-myst-500/18 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.11em] text-myst-200 transition hover:border-myst-300/70 hover:bg-myst-500/30 disabled:opacity-45"
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

            <button
              onClick={onClose}
              className="shrink-0 border border-white/18 bg-white/[0.07] p-2 text-white/80 transition hover:border-white/35 hover:bg-white/15 hover:text-white"
              style={cut(8)}
              aria-label="Закрыть магазин"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ---- Основная область: левое меню вкладок + контент ---- */}
        <div className="contents lg:grid lg:min-h-0 lg:grid-cols-[190px_1fr] lg:overflow-hidden">
          {/* ---- левый рельс ---- */}
          <div className="flex items-center gap-2 border-b border-white/12 bg-ink-950/70 p-2.5 sm:p-3 lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r">
            <div className="flex w-full gap-1.5 overflow-x-auto scroll-thin lg:flex-col lg:overflow-visible">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTab(t.id)}
                  className={`flex shrink-0 items-center gap-2 border px-2.5 py-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
                    tab === t.id
                      ? 'border-ember-300/55 bg-ember-400/15 text-ember-200'
                      : 'border-white/12 text-white/60 hover:border-white/30 hover:bg-white/5 hover:text-white'
                  }`}
                  style={cut(8)}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ---- контент ---- */}
          <div className="min-h-0 overflow-y-auto scroll-thin p-3.5 sm:p-5">
            {tab === 'sparks' && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PRODUCTS.map((p, i) => {
                  const price = storePrices[p.id] ?? p.price;
                  const featured = i === 0;
                  return (
                    <div
                      key={p.id}
                      className={`relative flex flex-col justify-between gap-3 border p-3.5 transition hover:-translate-y-0.5 ${
                        featured ? 'border-ember-300/45 bg-ember-400/10 sm:col-span-2 sm:flex-row sm:items-center' : 'border-white/14 bg-white/[0.04] hover:border-white/30'
                      }`}
                      style={cut(12)}
                    >
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold uppercase tracking-[0.04em]">{p.title}</div>
                        <div className="mt-0.5 text-[12px] leading-snug text-white/80">{p.note}</div>
                      </div>
                      <Btn
                        size={featured ? 'md' : 'sm'}
                        onClick={() => onBuyProduct(p)}
                        disabled={pendingSku === p.id}
                        variant={paymentsOn ? 'primary' : 'ghost'}
                        icon={<Star size={13} />}
                        className="shrink-0"
                      >
                        {pendingSku === p.id ? 'Покупка…' : price}
                      </Btn>
                    </div>
                  );
                })}
                <div className="text-[11px] leading-relaxed text-white/70 sm:col-span-2">
                  {paymentsOn
                    ? 'Цены берутся из каталога платежей площадки. Зачисление — сразу после подтверждения оплаты.'
                    : 'Платежи появятся после публикации игры. Сейчас витрина работает как предпросмотр: выдача имитируется, чтобы проверить экономику.'}
                </div>
              </div>
            )}

            {tab === 'skins' && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {SKINS.map((sk) => {
                  const owned = save.owned.includes(sk.id) || sk.price === 0;
                  const active = save.skin === sk.id;
                  return (
                    <div
                      key={sk.id}
                      className={`flex items-center gap-3 border px-3 py-2.5 transition ${
                        active ? 'border-sonar-400/60 bg-sonar-500/12' : 'border-white/12 bg-white/[0.03] hover:border-white/28'
                      }`}
                      style={cut(12)}
                    >
                      <View3DFrame onOpen={() => open3D('skin', sk.id)} label={`3D-осмотр: ${sk.name}`}>
                        <SkinSwatch id={sk.id} size={56} />
                      </View3DFrame>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-[13px] font-bold uppercase tracking-[0.04em]">{sk.name}</span>
                          {sk.price === 0 ? (
                            <span className="border border-sonar-400/35 px-1 font-display text-[9px] uppercase tracking-[0.14em] text-sonar-300">бесплатно</span>
                          ) : !owned ? (
                            <span className="border border-ember-300/40 px-1 font-display text-[9px] uppercase tracking-[0.14em] text-ember-300">авторский</span>
                          ) : null}
                          {active && <span className="font-display text-[10px] uppercase tracking-[0.16em] text-sonar-300">· надет</span>}
                        </div>
                        <div className="mt-0.5 flex-1 text-[11px] leading-snug text-white/78">{sk.desc}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {owned ? (
                            <Btn
                              size="sm"
                              variant={active ? 'quiet' : 'ghost'}
                              onClick={() => onSelectSkin(sk.id)}
                              icon={active ? <Check size={12} /> : <Sparkles size={12} />}
                            >
                              {active ? 'Активен' : 'Надеть'}
                            </Btn>
                          ) : (
                            <Btn
                              size="sm"
                              variant={save.sparks >= sk.price ? 'primary' : 'ghost'}
                              onClick={() => onBuySkin(sk.id)}
                              disabled={save.sparks < sk.price}
                              icon={<Star size={12} />}
                            >
                              {sk.price} ✦
                            </Btn>
                          )}
                          <Open3D onClick={() => open3D('skin', sk.id)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[11px] leading-relaxed text-white/60 sm:col-span-2">
                  3 текстурированных ядра доступны бесплатно сразу. 5 платных — авторские 3D-формы главной искры со своими
                  многослойными текстурами, короной свечения и бонусами на забег. Нажмите «3D-осмотр», чтобы покрутить любой скин.
                </div>
              </div>
            )}

            {tab === 'themes' && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {THEMES.map((t) => {
                  const owned = save.themes.includes(t.id) || t.price === 0;
                  const active = save.theme === t.id;
                  const can = owned || save.sparks >= t.price;
                  const paid = t.price > 0;
                  return (
                    <div
                      key={t.id}
                      className={`flex gap-3 border p-3 transition ${
                        active
                          ? 'border-sonar-400/65 bg-sonar-500/12'
                          : paid
                            ? 'border-ember-300/25 bg-white/[0.04] hover:border-ember-300/50'
                            : 'border-white/12 bg-white/[0.03] hover:border-white/30'
                      }`}
                      style={cut(12)}
                    >
                      <View3DFrame onOpen={() => open3D('theme', t.id)} label={`3D-осмотр: ${t.name}`}>
                        <ThemePreview t={t} />
                      </View3DFrame>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-[13px] font-bold uppercase tracking-[0.04em]">{t.name}</span>
                          {t.price === 0 ? (
                            <span className="border border-sonar-400/35 px-1 font-display text-[9px] uppercase tracking-[0.14em] text-sonar-300">
                              бесплатно
                            </span>
                          ) : !owned ? (
                            <span className="border border-ember-300/45 bg-ember-400/10 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-[0.14em] text-ember-200">
                              Новая архитектура
                            </span>
                          ) : null}
                          {active && <span className="font-display text-[10px] uppercase tracking-[0.16em] text-sonar-300">· активен</span>}
                        </div>
                        <div className="mt-0.5 flex-1 text-[11px] leading-snug text-white/80">{t.desc}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {owned ? (
                            <Btn
                              size="sm"
                              variant={active ? 'quiet' : 'ghost'}
                              onClick={() => onSelectTheme(t.id)}
                              icon={active ? <Check size={12} /> : <Sparkles size={12} />}
                            >
                              {active ? 'Активен' : 'Применить'}
                            </Btn>
                          ) : (
                            <Btn size="sm" variant={can ? 'primary' : 'ghost'} onClick={() => onBuyTheme(t.id)} disabled={!can} icon={<Star size={12} />}>
                              {t.price} ✦
                            </Btn>
                          )}
                          <Open3D onClick={() => open3D('theme', t.id)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[11px] leading-relaxed text-white/65 sm:col-span-2">
                  3 тоннеля открыты бесплатно. 5 платных — отдельная архитектура со своим материалом, светом и
                  ритмом рёбер; свечение и частицы приглушены, чтобы препятствия всегда читались. Нажмите «3D-осмотр», чтобы пройтись по тоннелю изнутри или рассмотреть его в разрезе.
                </div>
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
                  const icon = b.id === 'shield' ? <Check size={14} /> : <Zap size={14} />;
                  return (
                    <div key={b.id} className={`flex items-center gap-3 border px-3 py-2.5 ${on ? 'border-ember-300/50 bg-ember-400/10' : 'border-white/12 bg-white/[0.03]'}`} style={cut(10)}>
                      <span className="text-ember-300">{icon}</span>
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
                      <span className={a.done ? 'text-sonar-300' : 'text-white/55'}>{a.done ? <Check size={14} /> : <Award size={14} />}</span>
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
