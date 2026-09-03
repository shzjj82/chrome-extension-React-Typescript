import type { AnimationSheetDef } from '../animation/types';

/** 皮肤 id：未来多皮肤可扩展 */
type PetSkinId = string;

/** 动画 id：字符串，便于皮肤自定义 */
type PetSkinAnimId = string;

type PetSkinDef = {
  id: PetSkinId;
  /** 该皮肤下 animId → 雪碧图定义 */
  sheets: Record<PetSkinAnimId, AnimationSheetDef>;
  defaultAnim: PetSkinAnimId;
};

const PET_SKINS = new Map<PetSkinId, PetSkinDef>();

/** 注册 / 覆盖一整套皮肤动画表 */
const registerPetSkin = (skin: PetSkinDef) => {
  PET_SKINS.set(skin.id, {
    ...skin,
    sheets: { ...skin.sheets },
  });
};

/** 向已有皮肤追加或覆盖某一动画帧表 */
const registerSkinSheet = (skinId: PetSkinId, animId: PetSkinAnimId, sheet: AnimationSheetDef) => {
  const skin = PET_SKINS.get(skinId);
  if (!skin) {
    registerPetSkin({ id: skinId, defaultAnim: animId, sheets: { [animId]: sheet } });
    return;
  }
  skin.sheets[animId] = sheet;
};

const getPetSkin = (skinId: PetSkinId): PetSkinDef | undefined => PET_SKINS.get(skinId);

const requirePetSkin = (skinId: PetSkinId): PetSkinDef => {
  const skin = PET_SKINS.get(skinId);
  if (!skin) {
    throw new Error(`Pet skin not registered: ${skinId}`);
  }
  return skin;
};

/** 查询皮肤下某个动画的 sheet（没有则 undefined） */
const getSkinSheet = (skinId: PetSkinId, animId: PetSkinAnimId): AnimationSheetDef | undefined =>
  PET_SKINS.get(skinId)?.sheets[animId];

const listPetSkins = () => [...PET_SKINS.keys()];

export { getPetSkin, getSkinSheet, listPetSkins, PET_SKINS, registerPetSkin, registerSkinSheet, requirePetSkin };
export type { PetSkinAnimId, PetSkinDef, PetSkinId };
