/**
 * 宠物需求领域逻辑（饥饿 / 心情 / 成长）—— 与 PetController / 动画解耦。
 * 结算由 background alarm 与 PET_NEEDS_* 消息收口；本模块只定义规则与写入。
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
  /** 饥饿每分钟折损 */
  hungerLossPerMinute: number;
  /** 心情每分钟折损 */
  moodLossPerMinute: number;
  /** 跨本地日时：成长 = 昨日结算值 × 该比例，再开始当日累积 */
  growthDailyCarryRatio: number;
  /** 正餐回复量 */
  mealRestore: number;
  /** 预留：窗外零食回复 */
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

/** 内置回退值；运行配置优先读 CEB_PET_* 环境变量 */
const PET_NEEDS_FALLBACK = {
  hungerLossPerMinute: 70 / 1440,
  moodLossPerMinute: 36 / 1440,
  growthDailyCarryRatio: 0.3,
  mealRestore: 40,
  snackRestore: 12,
  thirdMealMoodBonus: 4,
} as const;

const readEnvNumber = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (raw == null || String(raw).trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const readEnvRatio = (key: string, fallback: number) => {
  const value = readEnvNumber(key, fallback);
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

/** 可替换规则：默认从环境变量组装，也可用 override 覆盖 */
const buildDefaultPetNeedsConfig = (): PetNeedsConfig => ({
  hungerLossPerMinute: readEnvNumber('CEB_PET_HUNGER_LOSS_PER_MIN', PET_NEEDS_FALLBACK.hungerLossPerMinute),
  moodLossPerMinute: readEnvNumber('CEB_PET_MOOD_LOSS_PER_MIN', PET_NEEDS_FALLBACK.moodLossPerMinute),
  growthDailyCarryRatio: readEnvRatio('CEB_PET_GROWTH_DAILY_CARRY_RATIO', PET_NEEDS_FALLBACK.growthDailyCarryRatio),
  mealRestore: readEnvNumber('CEB_PET_MEAL_RESTORE', PET_NEEDS_FALLBACK.mealRestore),
  snackRestore: readEnvNumber('CEB_PET_SNACK_RESTORE', PET_NEEDS_FALLBACK.snackRestore),
  thirdMealMoodBonus: readEnvNumber('CEB_PET_THIRD_MEAL_MOOD_BONUS', PET_NEEDS_FALLBACK.thirdMealMoodBonus),
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
});

const DEFAULT_PET_NEEDS_CONFIG: PetNeedsConfig = buildDefaultPetNeedsConfig();

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseLocalDateKey = (dateKey: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return null;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
};

/** 两个本地日 key 之间跨越的日切次数（同日为 0） */
const countLocalDaySteps = (fromKey: string, toKey: string) => {
  if (!fromKey || fromKey === toKey) {
    return 0;
  }
  const from = parseLocalDateKey(fromKey);
  const to = parseLocalDateKey(toKey);
  if (!from || !to) {
    return fromKey === toKey ? 0 : 1;
  }
  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.round(diffMs / 86_400_000);
};

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

const isInWindow = (minute: number, window: MealWindow) => minute >= window.startMin && minute <= window.endMin;

const resolveConfig = (override?: Partial<PetNeedsConfig>): PetNeedsConfig => {
  const base = buildDefaultPetNeedsConfig();
  return {
    ...base,
    ...override,
    windows: {
      ...base.windows,
      ...override?.windows,
    },
    bands: {
      ...base.bands,
      ...override?.bands,
    },
  };
};

const syncMealsDate = (meals: PetMealsToday, dateKey: string): PetMealsToday => {
  if (meals.dateKey === dateKey) {
    return meals;
  }
  return emptyMealsToday(dateKey);
};

const mealsFedCount = (meals: PetMealsToday) => Number(meals.breakfast) + Number(meals.lunch) + Number(meals.dinner);

/**
 * 成长跨日：每过一个本地日，保留上一天的 carryRatio（默认 30%），可连跳多日。
 * 无 growthDateKey 的旧数据：挂到今日，不立刻打折（避免升级一次砍掉 70%）。
 */
const applyGrowthDayCarry = (
  growth: number,
  growthDateKey: string,
  todayKey: string,
  carryRatio: number,
): { growth: number; growthDateKey: string } => {
  if (!growthDateKey) {
    return { growth: clampStat(growth), growthDateKey: todayKey };
  }
  const steps = countLocalDaySteps(growthDateKey, todayKey);
  if (steps <= 0) {
    return { growth: clampStat(growth), growthDateKey };
  }
  let next = growth;
  for (let i = 0; i < steps; i += 1) {
    next = clampStat(Math.round(next * carryRatio));
  }
  return { growth: next, growthDateKey: todayKey };
};

/** 当日累积成长（专注完成、学习等业务调用）；会先走 settle 语义外的纯增益 */
const applyGrowthGain = (stats: PetStatsType, amount: number): PetStatsType => {
  const base = normalizePetStats(stats);
  const gain = Number(amount) || 0;
  if (gain === 0) {
    return base;
  }
  return {
    ...base,
    growth: clampStat(base.growth + gain),
  };
};

/** 纯函数：按时间衰减饥饿/心情，跨日滚动餐次与成长继承 */
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
  const minutes = elapsedMs / 60_000;
  const hunger = clampStat(base.hunger - minutes * config.hungerLossPerMinute);
  const mood = clampStat(base.mood - minutes * config.moodLossPerMinute);

  const carried = applyGrowthDayCarry(base.growth, base.growthDateKey, dateKey, config.growthDailyCarryRatio);

  return {
    ...base,
    hunger,
    mood,
    growth: carried.growth,
    growthDateKey: carried.growthDateKey,
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
  prev.growthDateKey !== next.growthDateKey ||
  prev.lastFedAt !== next.lastFedAt ||
  prev.lastSettledAt !== next.lastSettledAt ||
  prev.mealsToday.dateKey !== next.mealsToday.dateKey ||
  prev.mealsToday.breakfast !== next.mealsToday.breakfast ||
  prev.mealsToday.lunch !== next.mealsToday.lunch ||
  prev.mealsToday.dinner !== next.mealsToday.dinner;

/** 读取并结算写入（优先 background alarm / PET_NEEDS_SETTLE，updater 降低同进程覆盖） */
const settleAndPersistPetStats = async (now = Date.now(), config?: Partial<PetNeedsConfig>): Promise<PetStatsType> => {
  const resolved = resolveConfig(config);
  let snapshot = normalizePetStats(await petStatsStorage.get());
  await petStatsStorage.set(prev => {
    const current = normalizePetStats(prev);
    const next = settlePetStats(current, now, resolved);
    snapshot = next;
    return statsChangedForPersist(current, next) ? next : current;
  });
  return snapshot;
};

/** 喂正餐：结算 → 校验 → updater 写入。成功后由 UI 自行 fire('eat') */
const feedPetMeal = async (
  slot: MealSlot,
  now = Date.now(),
  config?: Partial<PetNeedsConfig>,
): Promise<FeedPetResult> => {
  const resolved = resolveConfig(config);
  let result: FeedPetResult = {
    ok: false,
    reason: 'outside_window',
    stats: normalizePetStats(await petStatsStorage.get()),
    slot,
  };
  await petStatsStorage.set(prev => {
    result = applyMealFeed(normalizePetStats(prev), slot, now, resolved);
    return result.stats;
  });
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

/** 当日成长累积（业务侧调用；写入前会 settle） */
const addPetGrowth = async (
  amount: number,
  now = Date.now(),
  config?: Partial<PetNeedsConfig>,
): Promise<PetStatsType> => {
  const resolved = resolveConfig(config);
  let snapshot = normalizePetStats(await petStatsStorage.get());
  await petStatsStorage.set(prev => {
    const settled = settlePetStats(normalizePetStats(prev), now, resolved);
    const next = applyGrowthGain(settled, amount);
    snapshot = { ...next, lastSettledAt: now };
    return snapshot;
  });
  return snapshot;
};

export type { MealSlot, HungerBand, MealWindow, PetNeedsConfig, FeedPetFailureReason, FeedPetResult };

export {
  MEAL_SLOTS,
  PET_NEEDS_FALLBACK,
  DEFAULT_PET_NEEDS_CONFIG,
  buildDefaultPetNeedsConfig,
  toLocalDateKey,
  countLocalDaySteps,
  applyGrowthDayCarry,
  applyGrowthGain,
  settlePetStats,
  getActiveMealSlot,
  getHungerBand,
  canFeedMeal,
  applyMealFeed,
  settleAndPersistPetStats,
  feedPetMeal,
  feedPetActiveMeal,
  addPetGrowth,
};
