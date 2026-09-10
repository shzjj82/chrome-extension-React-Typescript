import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

/** 复习笔记卡片：来自整理通道的结构化笔记 */
type ReviewNoteItem = {
  id: string;
  title: string;
  preview: string;
  /** organize-note JSON 对象（无 memoryFacts） */
  note: Record<string, unknown>;
  sourceMessageId?: string;
  sourceThreadId?: string;
  createdAt: number;
};

type ReviewNotesState = {
  items: ReviewNoteItem[];
};

type ReviewNotesStorageType = BaseStorageType<ReviewNotesState> & {
  addNote: (input: {
    title: string;
    preview: string;
    note: Record<string, unknown>;
    sourceMessageId?: string;
    sourceThreadId?: string;
  }) => Promise<ReviewNoteItem>;
  removeNote: (id: string) => Promise<void>;
  hasSourceMessage: (messageId: string) => Promise<boolean>;
};

const MAX_ITEMS = 60;

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `review-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const storage = createStorage<ReviewNotesState>(
  'review-notes',
  { items: [] },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

const addNote: ReviewNotesStorageType['addNote'] = async input => {
  const now = Date.now();
  const existing = await storage.get();
  const dup = input.sourceMessageId
    ? (existing.items ?? []).find(item => item.sourceMessageId === input.sourceMessageId)
    : undefined;
  if (dup) {
    return dup;
  }

  const created: ReviewNoteItem = {
    id: createId(),
    title: input.title.trim() || '未命名笔记',
    preview: input.preview.trim().slice(0, 160),
    note: input.note,
    sourceMessageId: input.sourceMessageId,
    sourceThreadId: input.sourceThreadId,
    createdAt: now,
  };

  await storage.set(prev => ({
    items: [created, ...(prev.items ?? [])].slice(0, MAX_ITEMS),
  }));

  return created;
};

const removeNote: ReviewNotesStorageType['removeNote'] = async id => {
  await storage.set(prev => ({
    items: (prev.items ?? []).filter(item => item.id !== id),
  }));
};

const hasSourceMessage: ReviewNotesStorageType['hasSourceMessage'] = async messageId => {
  const state = await storage.get();
  return (state.items ?? []).some(item => item.sourceMessageId === messageId);
};

const reviewNotesStorage: ReviewNotesStorageType = {
  ...storage,
  addNote,
  removeNote,
  hasSourceMessage,
};

export type { ReviewNoteItem, ReviewNotesState, ReviewNotesStorageType };
export { reviewNotesStorage };
