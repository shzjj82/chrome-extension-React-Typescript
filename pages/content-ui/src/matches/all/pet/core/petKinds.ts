import type { PetAnimId } from '../animation/types';

/** 宠物种类：决定默认行为与可用动画 */
type PetKindId = 'study-buddy' | 'adoptable-pup';

type PetBehaviorMode = 'wander' | 'idle-loop';

type PetKindDef = {
  id: PetKindId;
  /** 默认循环 / 起始动画 */
  defaultAnim: PetAnimId;
  /** 该种类可用的动画（idle-loop 通常只有一种） */
  anims: readonly PetAnimId[];
  behavior: PetBehaviorMode;
};

const PET_KINDS: Record<PetKindId, PetKindDef> = {
  'study-buddy': {
    id: 'study-buddy',
    defaultAnim: 'run',
    anims: ['run', 'sit', 'sit-down'],
    behavior: 'wander',
  },
  /** 认养前小狗：只会 adopt-idle 循环，不散步 */
  'adoptable-pup': {
    id: 'adoptable-pup',
    defaultAnim: 'adopt-idle',
    anims: ['adopt-idle'],
    behavior: 'idle-loop',
  },
};

const registerPetKind = (kind: PetKindDef) => {
  PET_KINDS[kind.id] = kind;
};

const getPetKind = (id: PetKindId): PetKindDef => PET_KINDS[id];

export { getPetKind, PET_KINDS, registerPetKind };
export type { PetBehaviorMode, PetKindDef, PetKindId };
