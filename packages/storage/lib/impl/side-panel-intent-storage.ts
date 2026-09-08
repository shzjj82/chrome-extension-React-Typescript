import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

/** 与 messaging.SidePanelView 对齐：外部打开侧栏时的目标页 */
type SidePanelIntentView = 'study' | 'browse' | 'chat' | 'ask' | 'calendar';

type SidePanelIntent = {
  view: SidePanelIntentView;
  /** 每次打开写入新时间戳，侧栏凭此消费并去重 */
  at: number;
} | null;

type SidePanelIntentStorageType = BaseStorageType<SidePanelIntent>;

const sidePanelIntentStorage: SidePanelIntentStorageType = createStorage<SidePanelIntent>('side-panel-intent', null, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export type { SidePanelIntent, SidePanelIntentView, SidePanelIntentStorageType };
export { sidePanelIntentStorage };
