import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type UiSettingsType = {
  floatBallEnabled: boolean;
  floatBallCollapsed: boolean;
  floatBallPosition: { x: number; y: number };
};

type UiSettingsStorageType = BaseStorageType<UiSettingsType>;

const storage = createStorage<UiSettingsType>(
  'ui-settings',
  {
    floatBallEnabled: true,
    floatBallCollapsed: false,
    floatBallPosition: { x: -24, y: -120 },
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const uiSettingsStorage: UiSettingsStorageType = storage;

export type { UiSettingsType, UiSettingsStorageType };
export { uiSettingsStorage };
