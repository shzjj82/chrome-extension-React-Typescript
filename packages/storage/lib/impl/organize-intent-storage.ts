import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

/** 打开整理页时携带的材料范围 */
type OrganizeIntent = {
  dateKey: string;
  siteKeys: string[];
  at: number;
} | null;

type OrganizeIntentStorageType = BaseStorageType<OrganizeIntent>;

const organizeIntentStorage: OrganizeIntentStorageType = createStorage<OrganizeIntent>('organize-intent', null, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export type { OrganizeIntent, OrganizeIntentStorageType };
export { organizeIntentStorage };
