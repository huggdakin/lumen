/* eslint-disable @typescript-eslint/no-explicit-any */
// Обёртка над Yandex Games SDK v2. Без SDK (локальная разработка) все вызовы безопасно деградируют.

declare global {
  interface Window {
    YaGames?: any;
  }
}

const LEADERBOARD_NAME = 'lumenScore';
const SAVE_KEY = 'lumenSave';

let ysdk: any = null;
let player: any = null;

export function sdkReady(): boolean {
  return !!ysdk;
}

export async function initYandex(): Promise<boolean> {
  if (!window.YaGames) return false;
  try {
    ysdk = await window.YaGames.init();
    try {
      player = await ysdk.getPlayer({ scopes: false });
    } catch {
      player = null;
    }
    return true;
  } catch (e) {
    console.warn('[LUMEN] YaGames init failed', e);
    return false;
  }
}

/** Сообщает платформе, что игра загрузилась (обязательно для модерации). */
export function gameReady() {
  try {
    ysdk?.features?.LoadingAPI?.ready?.();
  } catch {
    /* ignore */
  }
}

export function gameplayStart() {
  try {
    ysdk?.features?.GameplayAPI?.start?.();
  } catch {
    /* ignore */
  }
}

export function gameplayStop() {
  try {
    ysdk?.features?.GameplayAPI?.stop?.();
  } catch {
    /* ignore */
  }
}

/** Есть ли у игрока Яндекс.Плюс — таким можно не показывать interstitial. */
export async function hasPlus(): Promise<boolean> {
  if (!ysdk?.plus) return false;
  try {
    if (ysdk.plus.isReady && !ysdk.plus.isReady()) await ysdk.plus.getReadyPromise?.();
    return (await ysdk.plus.getPlusStatus()) === 'plus';
  } catch {
    return false;
  }
}

export function getLang(): string {
  try {
    return ysdk?.environment?.i18n?.lang ?? 'ru';
  } catch {
    return 'ru';
  }
}

/** ---------------- Платежи площадки ---------------- */
export interface StoreProduct {
  id: string;
  price: string;
  title: string;
  description: string;
}

export interface StorePurchase {
  id: string;
  purchaseId: string;
}

let payments: any = null;

async function getPaymentsApi(): Promise<any | null> {
  if (!ysdk) return null;
  if (payments) return payments;
  try {
    payments = await ysdk.getPayments();
    return payments;
  } catch {
    return null;
  }
}

export async function paymentsAvailable(): Promise<boolean> {
  return !!(await getPaymentsApi());
}

/** Реальный каталог из консоли разработчика (цены в рублях от площадки). */
export async function getStoreProducts(): Promise<StoreProduct[]> {
  const api = await getPaymentsApi();
  if (!api) return [];
  try {
    const list = await api.getProducts();
    return (list.products ?? []).map((p: any) => ({
      id: p.id,
      price: p.price ?? '',
      title: p.title ?? p.id,
      description: p.description ?? '',
    }));
  } catch {
    return [];
  }
}

export async function purchaseProduct(id: string): Promise<{ ok: boolean; purchaseId?: string; error?: string }> {
  const api = await getPaymentsApi();
  if (!api) return { ok: false, error: 'unavailable' };
  try {
    const purchase = await api.purchaseProduct(id);
    return { ok: true, purchaseId: purchase?.id };
  } catch (e: any) {
    const code = String(e?.code ?? e?.message ?? '');
    if (code.includes('USER_CANCEL') || code.toLowerCase().includes('cancel')) return { ok: false, error: 'cancel' };
    if (code.includes('PURCHASE_ALREADY_UNDER_REVIEW')) return { ok: false, error: 'review' };
    return { ok: false, error: code || 'error' };
  }
}

export async function listPurchases(): Promise<StorePurchase[]> {
  const api = await getPaymentsApi();
  if (!api) return [];
  try {
    const res = await api.getPurchases();
    return (res.purchases ?? []).map((x: any) => ({ id: x.id, purchaseId: x.purchaseId }));
  } catch {
    return [];
  }
}

/** Расходники (пачки валюты) обязательно «consume», иначе игрок не сможет купить дважды. */
export async function consumePurchase(purchaseId: string): Promise<void> {
  const api = await getPaymentsApi();
  if (!api || !purchaseId) return;
  try {
    await api.consumePurchase(purchaseId);
  } catch {
    /* ignore */
  }
}

export interface CloudSave {
  best?: number;
  sparks?: number;
  runs?: number;
  owned?: string[];
  skin?: string;
}

export async function loadCloudSave(): Promise<CloudSave | null> {
  if (!player) return null;
  try {
    const data = await player.getData([SAVE_KEY]);
    const raw = data?.[SAVE_KEY];
    if (raw && typeof raw === 'object') return raw as CloudSave;
    if (typeof raw === 'number') return { best: raw };
  } catch {
    /* ignore */
  }
  return null;
}

export async function saveCloudSave(payload: CloudSave): Promise<void> {
  if (!player) return;
  try {
    await player.setData({ [SAVE_KEY]: payload }, true);
  } catch {
    /* ignore */
  }
}

/** Показывает рекорд в облаке/локально, если аккаунта нет. */
export async function loadBestLocal(): Promise<number> {
  try {
    return Number(localStorage.getItem('lumen.best') ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function saveBestLocal(score: number) {
  try {
    localStorage.setItem('lumen.best', String(score));
  } catch {
    /* ignore */
  }
}

/** Полноэкранная реклама. Резолвится, когда реклама закрыта. */
export function showInterstitial(): Promise<void> {
  return new Promise((resolve) => {
    if (!ysdk?.adv) return resolve();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    try {
      ysdk.adv.showFullscreenAdv({
        callbacks: { onClose: finish, onError: finish, onOffline: finish },
      });
      setTimeout(finish, 15000); // страховка
    } catch {
      finish();
    }
  });
}

/** Реклама с вознаграждением. true — если игрок досмотрел. */
export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!ysdk?.adv) return resolve(true); // локальная разработка: имитируем просмотр
    let rewarded = false;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(rewarded);
      }
    };
    try {
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => {
            rewarded = true;
          },
          onClose: finish,
          onError: finish,
        },
      });
    } catch {
      finish();
    }
  });
}

export async function submitScore(score: number): Promise<void> {
  if (!ysdk) return;
  try {
    const lb = await ysdk.getLeaderboards();
    await lb.setLeaderboardScore(LEADERBOARD_NAME, Math.floor(score));
  } catch {
    /* таблица может быть ещё не создана в консоли разработчика */
  }
}

export interface LbEntry {
  name: string;
  score: number;
  isMe: boolean;
}

export async function getLeaderboard(quantity = 12): Promise<{ entries: LbEntry[]; myScore: number | null }> {
  if (!ysdk) return { entries: [], myScore: null };
  try {
    const lb = await ysdk.getLeaderboards();
    const res = await lb.getLeaderboard(LEADERBOARD_NAME, { quantity, includeUserScore: true });
    const entries: LbEntry[] = (res.entries ?? []).map((e: any, i: number) => ({
      name: e.player?.uniqueInfo?.publicName || `Игрок ${i + 1}`,
      score: Number(e.scores?.[0]?.value ?? 0),
      isMe: !!e.player?.additionalInfo?.accessToken && e.player.additionalInfo.accessToken === player?.accessToken,
    }));
    const userScore = res.userScore?.scores?.[0]?.value;
    return { entries, myScore: userScore != null ? Number(userScore) : null };
  } catch {
    return { entries: [], myScore: null };
  }
}

/** «Оцените игру» — виджет платформы. Повышает конверсию в рейтинг, показываем по новому рекорду. */
export async function promptRating(): Promise<boolean> {
  if (!ysdk?.feedback?.canReview) return false;
  try {
    const can = await ysdk.feedback.canReview();
    if (!can?.value) return false;
    await ysdk.feedback.requestReview();
    return true;
  } catch {
    return false;
  }
}
