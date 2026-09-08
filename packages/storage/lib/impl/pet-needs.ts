/**
 * 宠物需求（饥饿）领域逻辑 —— 与 PetController / 动画解耦。
 * 后续加零食、心情联动、alarm 结算时只扩本模块 + config。
 */
import { clampStat, emptyMealsToday, normalizePetStats, petStatsStorage } from './pet-stats-storage.js';
import type { PetMealsToday, PetStatsType } from './pet-stats-storage.js';

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

type HungerBand = 'full' | 'ok' | 'low' | 'starving';

type MealWindow = {
  /** 当日分钟 [0, 24*60)，含 start、含 end */
  startMin: number;
  endMin: number;
};

type PetNeedsConfig = {
  /** 饥饿每小时衰减；默认约 70/天，两顿 ×40 可维持 */
  hungerPerHour: number;
  /** 正餐回复量 */
  mealRestore: number;
  /** 预留：窗外零食回复（本版 feed 未开放） */
  snackRestore: number;
  /** 第三顿额外心情 */
  thirdMealMoodBonus: number;
  windows: Record<MealSlot, MealWindow>;
  bands: {
    full: number;
    ok: number;
    low: number;
  };
};

type FeedPetFailureReason = 'outside_window' | 'already_fed';

type FeedPetResult =
  | { ok: true; stats: PetStatsType; slot: MealSlot; restored: number }
  | { ok: false; reason: FeedPetFailureReason; stats: PetStatsType; slot: MealSlot };

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** 可替换的默认规则，迭代时优先改这里或传入 override */
const DEFAULT_PET_NEEDS_CONFIG: PetNeedsConfig = {
  hungerPerHour: 70 / 24,
  mealRestore: 40,
  snackRestore: 12,
  thirdMealMoodBonus: 4,
  windows: {
    breakfast: { startMin: 7 * 60, endMin: 9 * 60 },
    lunch: { startMin: 11 * 60 + 30, endMin: 13 * 60 + 30 },
    dinner: { startMin: 17 * 60 + 30, endMin: 19 * 60 + 30 },
  },
  bands: {
    full: 80,
    ok: 40,
    low: 20,
  },
};

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

const isInWindow = (minute: number, window: MealWindow) => minute >= window.startMin && minute <= window.endMin;

const resolveConfig = (override?: Partial<PetNeedsConfig>): PetNeedsConfig => ({
  ...DEFAULT_PET_NEEDS_CONFIG,
  ...override,
  windows: {
    ...DEFAULT_PET_NEEDS_CONFIG.windows,
    ...override?.windows,
  },
  bands: {
    ...DEFAULT_PET_NEEDS_CONFIG.bands,
    ...override?.bands,
  },
});

const syncMealsDate = (meals: PetMealsToday, dateKey: string): PetMealsToday => {
  if (meals.dateKey === dateKey) {
    return meals;
  }
  return emptyMealsToday(dateKey);
};

const mealsFedCount = (meals: PetMealsToday) => Number(meals.breakfast) + Number(meals.lunch) + Number(meals.dinner);

/** 纯函数：按时间差衰减饥饿，并滚动本地日餐次 */
const settlePetStats = (
  stats: PetStatsType,
  now = Date.now(),
  config: PetNeedsConfig = DEFAULT_PET_NEEDS_CONFIG,
): PetStatsType => {
  const base = normalizePetStats(stats);
  const nowDate = new Date(now);
  const dateKey = toLocalDateKey(nowDate);
  const mealsToday = syncMealsDate(base.mealsToday, dateKey);

  const settledAt = base.lastSettledAt > 0 ? base.lastSettledAt : now;
  const elapsedMs = Math.max(0, now - settledAt);
  const hours = elapsedMs / 3_600_000;
  const hunger = clampStat(base.hunger - hours * config.hungerPerHour);

  return {
    ...base,
    hunger,
    lastSettledAt: now,
    mealsToday,
  };
};

const getActiveMealSlot = (now = Date.now(), config: PetNeedsConfig = DEFAULT_PET_NEEDS_CONFIG): MealSlot | null => {
  const minute = minutesOfDay(new Date(now));
  for (const slot of MEAL_SLOTS) {
    if (isInWindow(minute, config.windows[slot])) {
      return slot;
    }
  }
  return null;
};

const getHungerBand = (hunger: number, config: PetNeedsConfig = DEFAULT_PET_NEEDS_CONFIG): HungerBand => {
  const value = clampStat(hunger);
  if (value >= config.bands.full) {
    return 'full';
  }
  if (value >= config.bands.ok) {
    return 'ok';
  }
  if (value >= config.bands.low) {
    return 'low';
  }
  return 'starving';
};

/** 纯函数：能否喂指定正餐（先 settle 再判） */
const canFeedMeal = (
  stats: PetStatsType,
  slot: MealSlot,
  now = Date.now(),
  config: PetNeedsConfig = DEFAULT_PET_NEEDS_CONFIG,
): { ok: true; settled: PetStatsType } | { ok: false; reason: FeedPetFailureReason; settled: PetStatsType } => {
  const settled = settlePetStats(stats, now, config);
  const active = getActiveMealSlot(now, config);
  if (active !== slot) {
    return { ok: false, reason: 'outside_window', settled };
  }
  if (settled.mealsToday[slot]) {
    return { ok: false, reason: 'already_fed', settled };
  }
  return { ok: true, settled };
};

/** 纯函数：应用一顿正餐 */
const applyMealFeed = (
  stats: PetStatsType,
  slot: MealSlot,
  now = Date.now(),
  config: PetNeedsConfig = DEFAULT_PET_NEEDS_CONFIG,
): FeedPetResult => {
  const gate = canFeedMeal(stats, slot, now, config);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason, stats: gate.settled, slot };
  }

  const beforeMeals = gate.settled.mealsToday;
  const mealsToday: PetMealsToday = { ...beforeMeals, [slot]: true };
  const restored = config.mealRestore;
  const hunger = clampStat(gate.settled.hunger + restored);
  const fedCount = mealsFedCount(mealsToday);
  const mood = fedCount >= 3 ? clampStat(gate.settled.mood + config.thirdMealMoodBonus) : gate.settled.mood;

  const next: PetStatsType = {
    ...gate.settled,
    hunger,
    mood,
    lastFedAt: now,
    lastSettledAt: now,
    mealsToday,
  };

  return { ok: true, stats: next, slot, restored };
};

const statsChangedForPersist = (prev: PetStatsType, next: PetStatsType) =>
  prev.hunger !== next.hunger ||
  prev.mood !== next.mood ||
  prev.growth !== next.growth ||
  prev.lastFedAt !== next.lastFedAt ||
  prev.lastSettledAt !== next.lastSettledAt ||
  prev.mealsToday.dateKey !== next.mealsToday.dateKey ||
  prev.mealsToday.breakfast !== next.mealsToday.breakfast ||
  prev.mealsToday.lunch !== next.mealsToday.lunch ||
  prev.mealsToday.dinner !== next.mealsToday.dinner;

/** 读取并结算写入（打开 Popup / 挂载宠物时调用） */
const settleAndPersistPetStats = async (now = Date.now(), config?: Partial<PetNeedsConfig>): Promise<PetStatsType> => {
  const resolved = resolveConfig(config);
  const current = normalizePetStats(await petStatsStorage.get());
  const next = settlePetStats(current, now, resolved);
  if (statsChangedForPersist(current, next)) {
    await petStatsStorage.set(next);
  }
  return next;
};

/** 喂正餐：结算 → 校验 → 写入。成功后由 UI 自行 fire('eat') */
const feedPetMeal = async (
  slot: MealSlot,
  now = Date.now(),
  config?: Partial<PetNeedsConfig>,
): Promise<FeedPetResult> => {
  const resolved = resolveConfig(config);
  const current = normalizePetStats(await petStatsStorage.get());
  const result = applyMealFeed(current, slot, now, resolved);
  await petStatsStorage.set(result.stats);
  return result;
};

/** 当前窗内一键喂食（无窗则 outside_window，stats 仍会 settle 写入） */
const feedPetActiveMeal = async (
  now = Date.now(),
  config?: Partial<PetNeedsConfig>,
): Promise<FeedPetResult | { ok: false; reason: 'no_active_slot'; stats: PetStatsType }> => {
  const resolved = resolveConfig(config);
  const slot = getActiveMealSlot(now, resolved);
  if (!slot) {
    const stats = await settleAndPersistPetStats(now, resolved);
    return { ok: false, reason: 'no_active_slot', stats };
  }
  return feedPetMeal(slot, now, resolved);
};

export type { MealSlot, HungerBand, MealWindow, PetNeedsConfig, FeedPetFailureReason, FeedPetResult };

export {
  MEAL_SLOTS,
  DEFAULT_PET_NEEDS_CONFIG,
  toLocalDateKey,
  settlePetStats,
  getActiveMealSlot,
  getHungerBand,
  canFeedMeal,
  applyMealFeed,
  settleAndPersistPetStats,
  feedPetMeal,
  feedPetActiveMeal,
};
