import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

/** 宠物属性：0–100 */
type PetStatsType = {
  hunger: number;
  mood: number;
  growth: number;
};

type PetStatsStorageType = BaseStorageType<PetStatsType>;

const clampStat = (value: number) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

const defaultPetStats: PetStatsType = {
  hunger: 72,
  mood: 86,
  growth: 34,
};

const normalizePetStats = (stats: Partial<PetStatsType> | null | undefined): PetStatsType => {
  const safe = stats ?? {};
  return {
    hunger: clampStat(safe.hunger ?? defaultPetStats.hunger),
    mood: clampStat(safe.mood ?? defaultPetStats.mood),
    growth: clampStat(safe.growth ?? defaultPetStats.growth),
  };
};

const storage = createStorage<PetStatsType>('pet-stats', defaultPetStats, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const petStatsStorage: PetStatsStorageType = storage;

export type { PetStatsType, PetStatsStorageType };
export { clampStat, defaultPetStats, normalizePetStats, petStatsStorage };
