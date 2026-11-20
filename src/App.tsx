import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, type GameResult, type HudState } from './game/Engine';
import {
  GameOverScreen,
  Hud,
  LeaderboardOverlay,
  InfoOverlay,
  LoadingScreen,
  MenuScreen,
  PauseOverlay,
  Toasts,
  type LbRow,
} from './components/Screens';
import { Shop } from './components/Shop';
import {
  applyRun,
  buyBuff,
  buySkin,
  buyTheme,
  consumeLoadout,
  defaultSave,
  grantProduct,
  loadSave,
  mergeCloud,
  persist,
  selectTheme,
  skinById,
  toCloud,
  toggleLoadout,
  type MissionDef,
  type SaveData,
} from './game/state';
import { AD_COOLDOWN, AD_SPARKS, BUFFS, fxFromLoadout, productById, themeById, type Product } from './game/economy';
import { installHoverSound, setUiSound } from './components/ui';
import {
  gameReady,
  gameplayStart,
  gameplayStop,
  getLeaderboard,
  hasPlus,
  consumePurchase,
  initYandex,
  listPurchases,
  loadBestLocal,
  getStoreProducts,
  loadCloudSave,
  paymentsAvailable,
  promptRating,
  purchaseProduct,
  saveBestLocal,
  saveCloudSave,
  showInterstitial,
  showRewarded,
  submitScore,
} from './yandex';

type Screen = 'loading' | 'menu' | 'playing' | 'paused' | 'gameover';
type Overlay = 'none' | 'shop' | 'leaders' | 'info';
type ShopTab = 'sparks' | 'skins' | 'themes' | 'buffs' | 'ach';

const CONSUMABLE = new Set(['sparks', 'bundle']);

const INITIAL_HUD: HudState = {
  score: 0,
  light: 100,
  speed: 18,
  combo: 0,
  comboT: 1,
  orbs: 0,
  distance: 0,
  magnet: 0,
  overcharge: 0,
  shield: false,
  danger: 0,
  flow: 0,
  powerups: 0,
  nearMiss: 0,
  radar: [],
};

const INITIAL_RESULT: GameResult = {
  score: 0,
  orbs: 0,
  distance: 0,
  powerups: 0,
  nearMiss: 0,
  comboMax: 0,
  flowMax: 0,
};

interface Toast {
  id: number;
  text: string;
  tone: 'ember' | 'sonar' | 'myst';
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const screenRef = useRef<Screen>('loading');
  const overlayRef = useRef<Overlay>('none');
  const saveRef = useRef<SaveData>(defaultSave());
  const preGameOverSaveRef = useRef<SaveData | null>(null);
  const startingRef = useRef(false);
  const gamesPlayed = useRef(0);
  const ratedOnce = useRef(false);
  const toastId = useRef(1);
  const lastRun = useRef<{ result: GameResult; earned: number } | null>(null);
  const startRef = useRef<(() => void) | null>(null);

  const [screen, setScreenState] = useState<Screen>('loading');
  const [overlay, setOverlayState] = useState<Overlay>('none');
  const setOverlay = useCallback((o: Overlay | ((prev: Overlay) => Overlay)) => {
    const next = typeof o === 'function' ? (o as (p: Overlay) => Overlay)(overlayRef.current) : o;
    overlayRef.current = next;
    setOverlayState(next);
  }, []);
  const [shopTab, setShopTab] = useState<ShopTab>('sparks');
  const [save, setSave] = useState<SaveData>(defaultSave());
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [result, setResult] = useState<GameResult>(INITIAL_RESULT);
  const [muted, setMuted] = useState(false);
  const [musicLevel, setMusicLevel] = useState(1);
  const [canRevive, setCanRevive] = useState(true);
  const [reviveLoading, setReviveLoading] = useState(false);
  const [x2Used, setX2Used] = useState(false);
  const [x2Loading, setX2Loading] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [sparksEarned, setSparksEarned] = useState(0);
  const [missionsDone, setMissionsDone] = useState<MissionDef[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lb, setLb] = useState<{ rows: LbRow[]; myScore: number | null }>({ rows: [], myScore: null });
  const [hint, setHint] = useState(false);
  const [paymentsOn, setPaymentsOn] = useState(false);
  const [storePrices, setStorePrices] = useState<Record<string, string>>({});
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [adLeft, setAdLeft] = useState(0);
  const [plus, setPlus] = useState(false);

  const setScreen = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreenState(s);
  }, []);

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'ember') => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const updateSave = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
    persist(next);
    void saveCloudSave(toCloud(next));
  }, []);

  // ---------- зачистка чужих плашек хостинга вне #root (без сканирования игрового DOM) ----------
  useEffect(() => {
    const rx = /arena|built|watermark|made-with|badge/i;
    const purge = () => {
      const children = document.body.children;
      for (let i = children.length - 1; i >= 0; i--) {
        const el = children[i];
        if (el.id === 'root' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        if (rx.test(el.id) || rx.test(el.className?.toString?.() ?? '')) {
          el.remove();
        }
      }
    };
    purge();
    const mo = new MutationObserver(purge);
    mo.observe(document.body, { childList: true, subtree: false });
    return () => mo.disconnect();
  }, []);

  // ---------- загрузка ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, {
      onHud: setHud,
      onGameOver: (r) => {
        gameplayStop();
        const prev = saveRef.current;
        preGameOverSaveRef.current = prev;
        const isNew = r.score > prev.best;
        const out = applyRun(prev, r, false);
        if (isNew) saveBestLocal(r.score);
        updateSave(out.save);
        setSparksEarned(out.sparksEarned);
        setMissionsDone(out.missionsDone);
        setIsNewBest(isNew);
        setX2Used(false);
        lastRun.current = { result: r, earned: out.sparksEarned };
        setResult(r);
        setHud((h) => ({ ...h, radar: [] }));
        submitScore(r.score);

        let delay = 100;
        const beat = (text: string, tone: Toast['tone']) => {
          setTimeout(() => pushToast(text, tone), delay);
          delay += 240;
        };
        out.missionsDone.forEach((m) => beat(`Задание: ${m.label} +${m.reward}✦`, 'sonar'));
        out.achievements.forEach((a) => beat(`${a.name}: +${a.sparks}✦`, 'myst'));
        if (out.missionsDone.length || out.achievements.length) engine.sound.mission();
        if (isNew && !ratedOnce.current) {
          ratedOnce.current = true;
          setTimeout(() => void promptRating(), 1000);
        }
        setScreen('gameover');
      },
    });
    engineRef.current = engine;
    setUiSound(engine.sound);

    let cancelled = false;
    // hard-unlock аудио на iOS: первый тач где угодно возобновляет контекст
    const unlock = () => {
      engine.sound.resume();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('touchend', unlock);
    document.addEventListener('keydown', unlock);
    const removeHover = installHoverSound();

    const boot = async () => {
      const local = loadSave();
      saveRef.current = local;
      setSave(local);
      engine.setSkin(local.skin);
      engine.setTheme(local.theme);
      try {
        if (localStorage.getItem('lumen.muted') === '1') {
          setMuted(true);
          engine.sound.setMuted(true);
        }
      } catch {
        /* ignore */
      }
      try {
        const mv = localStorage.getItem('lumen.music');
        if (mv !== null) setMusicLevel(Number(mv) || 0);
      } catch {
        /* ignore */
      }

      const timeout = new Promise<boolean>((res) => setTimeout(() => res(false), 4500));
      await Promise.race([initYandex(), timeout]);
      gameReady();

      const [cloud, bestLocal, isPlus] = await Promise.all([loadCloudSave(), loadBestLocal(), hasPlus()]);
      setPlus(isPlus);

      // восстановление entitlements из реальных покупок
      const purchases = await listPurchases();
      const merged = mergeCloud(local, cloud as Record<string, unknown> | null);
      merged.best = Math.max(merged.best, bestLocal);
      for (const pu of purchases) {
        const p = productById(pu.id);
        if (p?.kind === 'noads' && !merged.entitlements.includes('noads')) merged.entitlements.push('noads');
      }

      if (cancelled) return;
      saveRef.current = merged;
      setSave(merged);
      persist(merged);
      engine.setSkin(merged.skin);
      engine.setTheme(merged.theme);

      if (await paymentsAvailable()) {
        setPaymentsOn(true);
        const list = await getStoreProducts();
        const prices: Record<string, string> = {};
        list.forEach((x) => (prices[x.id] = x.price));
        if (!cancelled) setStorePrices(prices);
      }
      setScreen('menu');
    };
    void boot();

    const onVis = () => {
      if (document.hidden && screenRef.current === 'playing') {
        engine.pause();
        gameplayStop();
        setScreen('paused');
      } else if (!document.hidden) {
        engine.sound.resume(); // iOS мог приостановить контекст в фоне
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const sc = screenRef.current;
      if (e.code === 'Space') {
        // пробел не должен «нажимать» сфокусированные кнопки / скроллить страницу
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      if (e.code === 'Escape' || e.code === 'KeyP' || (e.code === 'Space' && (sc === 'playing' || sc === 'paused') && overlayRef.current === 'none')) {
        if (overlayRef.current !== 'none') {
          setOverlay('none');
          return;
        }
        if (sc === 'playing') {
          engine.pause();
          gameplayStop();
          setScreen('paused');
        } else if (sc === 'paused') {
          engine.resume();
          gameplayStart();
          setScreen('playing');
        }
        return;
      }
      if (overlayRef.current !== 'none') return;
      if (sc === 'menu' && (e.code === 'Space' || e.code === 'Enter')) void startRef.current?.();
      if ((sc === 'paused' && (e.code === 'KeyR' || e.code === 'Enter')) ||
        (sc === 'gameover' && (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space'))
      ) {
        void startRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('keydown', unlock);
      removeHover();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      setUiSound(null);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushToast, setOverlay, setScreen, updateSave]);

  // ---------- громкость музыки ----------
  useEffect(() => {
    engineRef.current?.sound.setMusicVolume([0, 0.05, 0.12][musicLevel] ?? 0.05);
    try {
      localStorage.setItem('lumen.music', String(musicLevel));
    } catch {
      /* ignore */
    }
  }, [musicLevel]);

  // ---------- кулдаун бесплатных искр (тикает только когда открыт магазин) ----------
  useEffect(() => {
    const tick = () => setAdLeft(Math.max(0, save.freeAdAt + AD_COOLDOWN - Date.now()));
    tick();
    if (overlay !== 'shop') return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [save.freeAdAt, overlay]);

  // ---------- старт забега ----------
  const startGame = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || startingRef.current) return;
    startingRef.current = true;
    try {
      engine.sound.resume(); // iOS: резюмим строго внутри жеста, до любых await
      const d = saveRef.current;
      const noAds = d.entitlements.includes('noads') || plus;
      if (!noAds && gamesPlayed.current > 0 && gamesPlayed.current % 2 === 0) {
        engine.sound.setMuted(true);
        await showInterstitial();
        engine.sound.setMuted(muted);
        engine.sound.resume(); // iOS мог приостановить контекст за время рекламы
      }
      gamesPlayed.current++;

      const cur = saveRef.current;
      const fxIds = cur.loadout.filter((id) => (cur.buffs[id] ?? 0) > 0);
      const fx = fxFromLoadout(fxIds);
      if (fxIds.length) updateSave(consumeLoadout(cur));

      preGameOverSaveRef.current = null;
      setOverlay('none');
      setCanRevive(true);
      setIsNewBest(false);
      setMissionsDone([]);
      setSparksEarned(0);
      setX2Used(false);
      setHud(INITIAL_HUD);
      engine.setSkin(cur.skin);
      engine.setTheme(cur.theme);
      engine.setBestTarget(cur.best);
      engine.start(fx);
      gameplayStart();
      setHint(true);
      setTimeout(() => setHint(false), 2600);
      setScreen('playing');
    } finally {
      startingRef.current = false;
    }
  }, [muted, plus, setOverlay, setScreen, updateSave]);

  useEffect(() => {
    startRef.current = () => void startGame();
  }, [startGame]);

  // ---------- действия ----------
  const pauseGame = () => {
    engineRef.current?.pause();
    gameplayStop();
    setScreen('paused');
  };
  const resumeGame = () => {
    engineRef.current?.resume();
    gameplayStart();
    setScreen('playing');
  };
  const toMenu = () => {
    engineRef.current?.stopToMenu();
    gameplayStop();
    setOverlay('none');
    setScreen('menu');
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    engineRef.current?.sound.setMuted(m);
    try {
      localStorage.setItem('lumen.muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const revive = async () => {
    const engine = engineRef.current;
    if (!engine || reviveLoading || !canRevive) return;
    setReviveLoading(true);
    engine.sound.setMuted(true);
    const ok = await showRewarded();
    engine.sound.setMuted(muted);
    engine.sound.resume();
    setReviveLoading(false);
    if (ok) {
      // Откатываем промежуточное начисление до конца продолженного забега, чтобы не было двойного начисления
      if (preGameOverSaveRef.current) {
        updateSave(preGameOverSaveRef.current);
        preGameOverSaveRef.current = null;
      }
      setCanRevive(false);
      engine.revive();
      gameplayStart();
      setScreen('playing');
      pushToast('Искра вспыхнула снова', 'myst');
    } else pushToast('Реклама недоступна', 'sonar');
  };

  const claimX2 = async () => {
    const engine = engineRef.current;
    const run = lastRun.current;
    if (!engine || !run || x2Used) return;
    setX2Loading(true);
    engine.sound.setMuted(true);
    const ok = await showRewarded();
    engine.sound.setMuted(muted);
    engine.sound.resume();
    setX2Loading(false);
    if (!ok) {
      pushToast('Реклама недоступна', 'sonar');
      return;
    }
    const d = saveRef.current;
    const next = { ...d, sparks: d.sparks + run.earned };
    updateSave(next);
    preGameOverSaveRef.current = null;
    setCanRevive(false);
    setSparksEarned((v) => v * 2);
    setX2Used(true);
    engine.sound.chest(true);
    pushToast(`×2: +${run.earned}✦`, 'ember');
  };

  const freeSparksAd = async () => {
    if (adLeft > 0) return;
    const engine = engineRef.current;
    engine?.sound.setMuted(true);
    const ok = await showRewarded();
    engine?.sound.setMuted(muted);
    engine?.sound.resume();
    if (!ok) {
      pushToast('Реклама недоступна', 'sonar');
      return;
    }
    const d = saveRef.current;
    updateSave({ ...d, sparks: d.sparks + AD_SPARKS, freeAdAt: Date.now() });
    engine?.sound.buy();
    pushToast(`+${AD_SPARKS}✦ за просмотр рекламы`, 'ember');
  };

  const buyProduct = async (p: Product) => {
    const engine = engineRef.current;
    if (pendingSku) return;
    setPendingSku(p.id);
    if (paymentsOn) {
      const res = await purchaseProduct(p.id);
      if (!res.ok) {
        setPendingSku(null);
        engine?.sound.deny();
        pushToast(res.error === 'cancel' ? 'Покупка отменена' : 'Оплата не прошла', 'sonar');
        return;
      }
      if (CONSUMABLE.has(p.kind) && res.purchaseId) await consumePurchase(res.purchaseId);
    } else {
      // Локальная разработка / черновик: имитируем выдачу, чтобы экономику можно было пощупать
      await new Promise((r) => setTimeout(r, 500));
      pushToast('SDK платежей недоступен — выдача имитирована', 'myst');
    }
    const next = grantProduct(saveRef.current, p);
    updateSave(next);
    engine?.sound.buy();
    pushToast(`${p.title} — доставлено`, 'ember');
    setPendingSku(null);
  };

  const doBuySkin = (id: string) => {
    const sk = skinById(id);
    const d = saveRef.current;
    if (d.owned.includes(id)) return;
    if (d.sparks < sk.price) {
      engineRef.current?.sound.deny();
      pushToast('Не хватает искр', 'sonar');
      return;
    }
    updateSave(buySkin(d, sk.price, id));
    engineRef.current?.setSkin(id);
    engineRef.current?.sound.buy();
    pushToast(`${sk.name} — надет`, 'ember');
  };

  const doSelectSkin = (id: string) => {
    const cur = saveRef.current;
    const owned = cur.owned.includes(id) ? cur.owned : [...cur.owned, id];
    updateSave({ ...cur, owned, skin: id });
    engineRef.current?.setSkin(id);
    engineRef.current?.sound.click();
  };

  const doBuyTheme = (id: string) => {
    const t = themeById(id);
    const d = saveRef.current;
    if (d.themes.includes(id)) {
      updateSave(selectTheme(d, id));
      engineRef.current?.setTheme(id);
      return;
    }
    if (d.sparks < t.price) {
      engineRef.current?.sound.deny();
      pushToast('Не хватает искр', 'sonar');
      return;
    }
    const next = buyTheme(d, id, t.price);
    updateSave(next);
    engineRef.current?.setTheme(next.theme);
    engineRef.current?.sound.buy();
    pushToast(`Тоннель «${t.name}» активен`, 'sonar');
  };

  const doSelectTheme = (id: string) => {
    updateSave(selectTheme(saveRef.current, id));
    engineRef.current?.setTheme(id);
    engineRef.current?.sound.click();
  };

  const doBuyBuff = (id: string) => {
    const def = BUFFS.find((b) => b.id === id);
    const d = saveRef.current;
    if (!def) return;
    if (d.sparks < def.price) {
      engineRef.current?.sound.deny();
      pushToast('Не хватает искр', 'sonar');
      return;
    }
    const next = buyBuff(d, id, 1);
    updateSave(next);
    engineRef.current?.sound.buy();
    pushToast(`${def.name} ×1`, 'ember');
  };

  const doToggleLoadout = (id: string) => {
    const next = toggleLoadout(saveRef.current, id);
    updateSave(next);
    engineRef.current?.sound.click();
  };

  const openLeaders = async () => {
    setOverlay('leaders');
    const res = await getLeaderboard(12);
    setLb({ rows: res.entries.map((e) => ({ name: e.name, score: e.score, isMe: e.isMe })), myScore: res.myScore });
  };

  const openShop = (tab?: string) => {
    if (screenRef.current === 'gameover') {
      preGameOverSaveRef.current = null;
      setCanRevive(false);
    }
    setShopTab((tab as ShopTab) ?? 'sparks');
    setOverlay((o) => (o === 'shop' && !tab ? 'none' : 'shop'));
  };

  const missions = useMemo(() => save.missions.map((def) => ({ def, p: save.progress[def.id]?.p ?? 0 })), [save]);
  const theme = themeById(save.theme);

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink-950 text-white" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {screen !== 'playing' && (
          <>
            <div
              className={`layer-beams absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 ${
                screen === 'paused' ? 'opacity-0' : 'opacity-70'
              }`}
            />
            <div className={`layer-hatch absolute inset-0 ${screen === 'paused' ? 'opacity-15' : 'opacity-55'}`} />
            <div className="layer-grain absolute inset-0" />
          </>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(4,3,12,0.82)_100%)]" />
        {theme.id === 'zero' && (screen === 'playing' || screen === 'paused') && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.9) 100%), repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 4px)',
              mixBlendMode: 'normal',
            }}
          />
        )}
        {screen === 'menu' && (
          <div
            className="absolute -bottom-28 left-1/4 h-72 w-[38rem] -translate-x-1/2 rounded-full blur-[95px] transition-colors duration-700"
            style={{ background: theme.accent + '26' }}
          />
        )}
      </div>

      <div className="ui-shadow pointer-events-none absolute inset-0 select-none">
        {screen === 'loading' && <LoadingScreen />}

        {screen === 'menu' && (
          <MenuScreen
            save={save}
            muted={muted}
            missions={missions}
            onPlay={startGame}
            onToggleMute={toggleMute}
            onShop={openShop}
            onLeaders={openLeaders}
            onInfo={() => setOverlay('info')}
          />
        )}

        {(screen === 'playing' || screen === 'paused') && <Hud hud={hud} onPause={pauseGame} />}

        {screen === 'playing' && hint && (
          <div className="absolute inset-x-0 bottom-24 flex animate-pulse justify-center font-display text-[11px] uppercase tracking-[0.24em] text-white/95">
            веди пальцем или клавиши A / D
          </div>
        )}

        {screen === 'paused' && (
          <PauseOverlay
            hud={hud}
            musicLevel={musicLevel}
            onMusicLevel={setMusicLevel}
            onResume={resumeGame}
            onRestart={startGame}
            onMenu={toMenu}
            muted={muted}
            onToggleMute={toggleMute}
          />
        )}

        {screen === 'gameover' && (
          <GameOverScreen
            result={result}
            save={save}
            isNewBest={isNewBest}
            sparksEarned={sparksEarned}
            missionsDone={missionsDone}
            missions={missions}
            canRevive={canRevive}
            reviveLoading={reviveLoading}
            canX2={sparksEarned > 0}
            x2Loading={x2Loading}
            x2Used={x2Used}
            onRevive={revive}
            onX2={claimX2}
            onRetry={startGame}
            onMenu={toMenu}
            onShop={() => openShop('skins')}
          />
        )}

        {overlay === 'shop' && (
          <Shop
            save={save}
            tab={shopTab}
            onTab={setShopTab}
            storePrices={storePrices}
            paymentsOn={paymentsOn}
            pendingSku={pendingSku}
            adCooldown={adLeft}
            onBuyProduct={buyProduct}
            onWatchForSparks={freeSparksAd}
            onBuySkin={doBuySkin}
            onSelectSkin={doSelectSkin}
            onBuyTheme={doBuyTheme}
            onSelectTheme={doSelectTheme}
            onBuyBuff={doBuyBuff}
            onToggleLoadout={doToggleLoadout}
            onClose={() => setOverlay('none')}
          />
        )}

        {overlay === 'leaders' && (
          <LeaderboardOverlay rows={lb.rows} myScore={lb.myScore} fallback={save} onClose={() => setOverlay('none')} />
        )}

        {overlay === 'info' && (
          <InfoOverlay
            muted={muted}
            musicLevel={musicLevel}
            onToggleMute={toggleMute}
            onMusicLevel={setMusicLevel}
            onClose={() => setOverlay('none')}
          />
        )}

        <Toasts items={toasts} />
      </div>
    </div>
  );
}
