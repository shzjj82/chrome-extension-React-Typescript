import { createStorage, StorageEnum } from '../base/index.js';
import type { LearningModePreference } from './user-profile-storage.js';
import type { BaseStorageType } from '../base/index.js';

type MaterialSourceType = 'page' | 'caption' | 'visible_caption' | 'paste' | 'subtitle_file';

type LearningDraftType = {
  sessionId: string | null;
  title: string;
  sourceUrl: string;
  material: string;
  materialSource: MaterialSourceType;
  mode: LearningModePreference;
  updatedAt: number;
};

type LearningDraftStorageType = BaseStorageType<LearningDraftType>;

const storage = createStorage<LearningDraftType>(
  'learning-draft',
  {
    sessionId: null,
    title: '',
    sourceUrl: '',
    material: '',
    materialSource: 'page',
    mode: 'note',
    updatedAt: 0,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const learningDraftStorage: LearningDraftStorageType = storage;

export type { MaterialSourceType, LearningDraftType, LearningDraftStorageType };
export { learningDraftStorage };
