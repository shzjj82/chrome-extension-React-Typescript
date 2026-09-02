import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type LearningModePreference = 'note' | 'quiz' | 'practice';
type KnowledgeDepth = 'shallow' | 'normal' | 'deep';
type LearningGoal = 'application' | 'principle' | 'exam';

type UserProfileType = {
  onboardingCompleted: boolean;
  /** 是否已在宠物气泡完成认养（填档案并保存） */
  petAdopted: boolean;
  occupation: string;
  domains: string;
  goal: LearningGoal;
  depth: KnowledgeDepth;
  preferredModes: LearningModePreference[];
};

type UserProfileStorageType = BaseStorageType<UserProfileType>;

const defaultProfile: UserProfileType = {
  onboardingCompleted: false,
  petAdopted: false,
  occupation: '',
  domains: '',
  goal: 'application',
  depth: 'normal',
  preferredModes: ['note'],
};

const storage = createStorage<UserProfileType>('user-profile', defaultProfile, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const userProfileStorage: UserProfileStorageType = storage;

const normalizeUserProfile = (profile: Partial<UserProfileType>): UserProfileType => ({
  ...defaultProfile,
  ...profile,
  occupation: profile.occupation ?? '',
  domains: profile.domains ?? '',
  preferredModes: profile.preferredModes ?? defaultProfile.preferredModes,
});

const isUserProfileFilled = (profile: UserProfileType): boolean =>
  profile.occupation.trim().length > 0 && profile.domains.trim().length > 0;

/** 宠物气泡是否应显示「认养」而非「学习/休息」 */
const shouldPromptPetAdoption = (profile: Partial<UserProfileType>): boolean =>
  !normalizeUserProfile(profile).petAdopted;

export type { LearningModePreference, KnowledgeDepth, LearningGoal, UserProfileType, UserProfileStorageType };
export { isUserProfileFilled, normalizeUserProfile, shouldPromptPetAdoption, userProfileStorage };
