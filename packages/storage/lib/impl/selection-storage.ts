import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type SelectionFavorite = {
  id: string;
  text: string;
  sourceUrl: string;
  pageTitle: string;
  createdAt: number;
};

type SelectionAskDraft = {
  text: string;
  sourceUrl: string;
  pageTitle: string;
  createdAt: number;
} | null;

type SelectionFavoritesState = {
  items: SelectionFavorite[];
};

type SelectionAskDraftStorageType = BaseStorageType<SelectionAskDraft>;
type SelectionFavoritesStorageType = BaseStorageType<SelectionFavoritesState> & {
  addFavorite: (
    input: Omit<SelectionFavorite, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
  ) => Promise<SelectionFavorite>;
  removeFavorite: (id: string) => Promise<void>;
};

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `sel-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const selectionAskDraftStorage: SelectionAskDraftStorageType = createStorage<SelectionAskDraft>(
  'selection-ask-draft',
  null,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const favoritesBase = createStorage<SelectionFavoritesState>(
  'selection-favorites',
  { items: [] },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const selectionFavoritesStorage: SelectionFavoritesStorageType = {
  ...favoritesBase,
  addFavorite: async input => {
    const text = input.text.trim();
    if (!text) {
      throw new Error('没有可收藏的内容');
    }
    const favorite: SelectionFavorite = {
      id: input.id ?? createId(),
      text,
      sourceUrl: input.sourceUrl || '',
      pageTitle: input.pageTitle || '',
      createdAt: input.createdAt ?? Date.now(),
    };
    await favoritesBase.set(prev => {
      const deduped = prev.items.filter(
        item => !(item.text === favorite.text && item.sourceUrl === favorite.sourceUrl),
      );
      return { items: [favorite, ...deduped].slice(0, 200) };
    });
    return favorite;
  },
  removeFavorite: async id => {
    await favoritesBase.set(prev => ({
      items: prev.items.filter(item => item.id !== id),
    }));
  },
};

export type {
  SelectionFavorite,
  SelectionAskDraft,
  SelectionAskDraftStorageType,
  SelectionFavoritesState,
  SelectionFavoritesStorageType,
};
export { selectionAskDraftStorage, selectionFavoritesStorage };
