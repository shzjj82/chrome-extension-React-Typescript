import type { PetSkinId } from '../animation/skins';
import type { PetAnimId } from '../animation/types';

/** 宠物种类：决定行为模式；皮肤（资源）通过 skinId 绑定 */
type PetKindId = 'study-pet' | 'adoptable-pet' | (string & {});

type PetBehaviorMode = 'wander' | 'idle-loop';

type PetKindDef = {
  id: PetKindId;
  /** 皮肤 id（与 kind 分离，便于同行为换皮） */
  skinId: PetSkinId;
  defaultAnim: PetAnimId;
  anims: readonly PetAnimId[];
  behavior: PetBehaviorMode;
};

const PET_KINDS: Record<string, PetKindDef> = {
  'study-pet': {
    id: 'study-pet',
    skinId: 'skin-pet-default',
    defaultAnim: 'run',
    anims: ['run', 'sit', 'sit-down'],
    behavior: 'wander',
  },
  'adoptable-pet': {
    id: 'adoptable-pet',
    skinId: 'skin-pet-adopt',
    defaultAnim: 'adopt-idle',
    anims: ['adopt-idle'],
    behavior: 'idle-loop',
  },
};

const registerPetKind = (kind: PetKindDef) => {
  PET_KINDS[kind.id] = kind;
};

const getPetKind = (id: PetKindId): PetKindDef => {
  const kind = PET_KINDS[id];
  if (!kind) {
    throw new Error(`Pet kind not registered: ${id}`);
  }
  return kind;
};

export { getPetKind, PET_KINDS, registerPetKind };
export type { PetBehaviorMode, PetKindDef, PetKindId };
