import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type DesktopLayoutState = {
  /** 主屏应用顺序 */
  homeOrder: string[];
  /** 程序坞应用顺序 */
  dockOrder: string[];
  /** 已删除的可卸载应用 id */
  removedIds: string[];
};

type DesktopLayoutStorageType = BaseStorageType<DesktopLayoutState>;

const DEFAULT_LAYOUT: DesktopLayoutState = {
  homeOrder: [],
  dockOrder: [],
  removedIds: [],
};

const desktopLayoutStorage: DesktopLayoutStorageType = createStorage<DesktopLayoutState>(
  'desktop-layout-v1',
  DEFAULT_LAYOUT,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type { DesktopLayoutState, DesktopLayoutStorageType };
export { desktopLayoutStorage, DEFAULT_LAYOUT };
