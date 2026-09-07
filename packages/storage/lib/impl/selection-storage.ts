import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type SelectionAskDraft = {
  text: string;
  sourceUrl: string;
  pageTitle: string;
  createdAt: number;
} | null;

type SelectionAskSessionMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
};

type SelectionAskSessionLink = {
  title: string;
  url: string;
};

/** 当前划选提问的会话缓存，避免切 Tab / 重进页面反复请求 */
type SelectionAskSession = {
  draftKey: string;
  askedKey: string;
  messages: SelectionAskSessionMessage[];
  links: SelectionAskSessionLink[];
  favoriteId: string | null;
  favoriteCreatedAt: number | null;
} | null;

type SelectionAskDraftStorageType = BaseStorageType<SelectionAskDraft>;
type SelectionAskSessionStorageType = BaseStorageType<SelectionAskSession>;

const selectionAskDraftStorage: SelectionAskDraftStorageType = createStorage<SelectionAskDraft>(
  'selection-ask-draft',
  null,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const selectionAskSessionStorage: SelectionAskSessionStorageType = createStorage<SelectionAskSession>(
  'selection-ask-session',
  null,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type {
  SelectionAskDraft,
  SelectionAskDraftStorageType,
  SelectionAskSession,
  SelectionAskSessionStorageType,
  SelectionAskSessionMessage,
  SelectionAskSessionLink,
};
export { selectionAskDraftStorage, selectionAskSessionStorage };
