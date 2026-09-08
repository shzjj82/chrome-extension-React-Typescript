import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

/** 本地日三餐打卡（与 hunger 数值解耦，方便以后换规则） */
type PetMealsToday = {
  dateKey: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
};

/** 宠物属性：0–100；时间戳与餐次供 needs 层结算，不进 PetController */
type PetStatsType = {
  hunger: number;
  mood: number;
  growth: number;
  /** 上次成功正餐喂食 */
  lastFedAt: number;
  /** 上次按时间衰减结算 */
  lastSettledAt: number;
  mealsToday: PetMealsToday;
};

type PetStatsStorageType = BaseStorageType<PetStatsType>;

const clampStat = (value: number) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

const emptyMealsToday = (dateKey = ''): PetMealsToday => ({
  dateKey,
  breakfast: false,
  lunch: false,
  dinner: false,
});

const defaultPetStats: PetStatsType = {
  hunger: 72,
  mood: 86,
  growth: 34,
  lastFedAt: 0,
  lastSettledAt: 0,
  mealsToday: emptyMealsToday(),
};

const normalizeMealsToday = (meals: Partial<PetMealsToday> | null | undefined): PetMealsToday => {
  const safe = meals ?? {};
  return {
    dateKey: typeof safe.dateKey === 'string' ? safe.dateKey : '',
    breakfast: Boolean(safe.breakfast),
    lunch: Boolean(safe.lunch),
    dinner: Boolean(safe.dinner),
  };
};

const normalizePetStats = (stats: Partial<PetStatsType> | null | undefined): PetStatsType => {
  const safe = stats ?? {};
  const now = Date.now();
  return {
    hunger: clampStat(safe.hunger ?? defaultPetStats.hunger),
    mood: clampStat(safe.mood ?? defaultPetStats.mood),
    growth: clampStat(safe.growth ?? defaultPetStats.growth),
    lastFedAt: Math.max(0, Math.floor(Number(safe.lastFedAt) || 0)),
    // 旧数据无时间戳时，从「现在」起算，避免一次补扣整天
    lastSettledAt: Math.max(0, Math.floor(Number(safe.lastSettledAt) || 0)) || now,
    mealsToday: normalizeMealsToday(safe.mealsToday),
  };
};

const storage = createStorage<PetStatsType>('pet-stats', defaultPetStats, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const petStatsStorage: PetStatsStorageType = storage;

export type { PetMealsToday, PetStatsType, PetStatsStorageType };
export { clampStat, defaultPetStats, emptyMealsToday, normalizeMealsToday, normalizePetStats, petStatsStorage };
