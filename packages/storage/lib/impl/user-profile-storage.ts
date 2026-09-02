import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type LearningModePreference = 'note' | 'quiz' | 'practice';
type KnowledgeDepth = 'shallow' | 'normal' | 'deep';
type LearningGoal = 'application' | 'principle' | 'exam';
/** 用户性别：认养用户信息用 */
type UserGender = 'male' | 'female' | 'other' | '';

type UserProfileType = {
  onboardingCompleted: boolean;
  /** 是否已完成宠物认养（仅用户信息） */
  petAdopted: boolean;
  /** 称呼 / 昵称 */
  nickname: string;
  /** 性别 */
  gender: UserGender;
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
  nickname: '',
  gender: '',
  occupation: '',
  domains: '',
  goal: 'application',
  depth: 'normal',
  preferredModes: ['note'],
};

const normalizeUserProfile = (profile: Partial<UserProfileType> | null | undefined): UserProfileType => {
  const safe = profile ?? {};
  return {
    ...defaultProfile,
    ...safe,
    nickname: safe.nickname ?? '',
    gender: safe.gender ?? '',
    occupation: safe.occupation ?? '',
    domains: safe.domains ?? '',
    preferredModes: safe.preferredModes ?? defaultProfile.preferredModes,
    petAdopted: safe.petAdopted ?? false,
    onboardingCompleted: safe.onboardingCompleted ?? false,
  };
};

const storage = createStorage<UserProfileType>('user-profile', defaultProfile, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const userProfileStorage: UserProfileStorageType = storage;

/** 认养所需的用户信息是否齐全（不含学习偏好）；兼容旧存档缺字段 */
const isAdoptionUserInfoFilled = (profile: Partial<UserProfileType> | null | undefined): boolean => {
  const normalized = normalizeUserProfile(profile);
  return normalized.nickname.trim().length > 0 && normalized.gender !== '' && normalized.occupation.trim().length > 0;
};

const isUserProfileFilled = (profile: Partial<UserProfileType> | null | undefined): boolean =>
  isAdoptionUserInfoFilled(profile);

/** 宠物气泡是否应显示「认养」而非「学习/休息」 */
const shouldPromptPetAdoption = (profile: Partial<UserProfileType> | null | undefined): boolean =>
  !normalizeUserProfile(profile).petAdopted;

export type {
  LearningModePreference,
  KnowledgeDepth,
  LearningGoal,
  UserGender,
  UserProfileType,
  UserProfileStorageType,
};
export {
  isAdoptionUserInfoFilled,
  isUserProfileFilled,
  normalizeUserProfile,
  shouldPromptPetAdoption,
  userProfileStorage,
};
