import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type SelectionAskDraft = {
  text: string;
  sourceUrl: string;
  pageTitle: string;
  createdAt: number;
} | null;

type SelectionAskDraftStorageType = BaseStorageType<SelectionAskDraft>;

const selectionAskDraftStorage: SelectionAskDraftStorageType = createStorage<SelectionAskDraft>(
  'selection-ask-draft',
  null,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type { SelectionAskDraft, SelectionAskDraftStorageType };
export { selectionAskDraftStorage };
