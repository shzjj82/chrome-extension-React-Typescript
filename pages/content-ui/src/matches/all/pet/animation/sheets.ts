import { registerPetSkin, registerSkinSheet } from './skins';
import adoptIdleSheetUrl from '../assets/adopt-idle.png';
import runSheetUrl from '../assets/run.png';
import sitDownSheetUrl from '../assets/sit-down.png';
import sitSheetUrl from '../assets/sit.png';
import type { AnimationSheetDef, BuiltinPetAnimId } from './types';

/**
 * 兼容旧全局表：默认皮肤的 sheet 镜像。
 * 新代码请优先 registerPetSkin / getSkinSheet。
 */
const PET_ANIMATION_SHEETS: Record<BuiltinPetAnimId, AnimationSheetDef> = {
  run: { url: runSheetUrl, frames: 5, frameMs: 90, loop: true },
  sit: { url: sitSheetUrl, frames: 8, frameMs: 220, loop: false },
  'sit-down': { url: sitDownSheetUrl, frames: 4, frameMs: 110, loop: false },
  'adopt-idle': { url: adoptIdleSheetUrl, frames: 8, frameMs: 140, loop: true, sourceFrame: 198 },
};

const registerAnimationSheet = (id: BuiltinPetAnimId, sheet: AnimationSheetDef) => {
  PET_ANIMATION_SHEETS[id] = sheet;
  registerSkinSheet('skin-pet-default', id, sheet);
};

/** 注册内置皮肤动画表（多皮肤差异从这里扩展） */
const registerBuiltinSkins = () => {
  registerPetSkin({
    id: 'skin-pet-default',
    defaultAnim: 'run',
    sheets: {
      run: PET_ANIMATION_SHEETS.run,
      sit: PET_ANIMATION_SHEETS.sit,
      'sit-down': PET_ANIMATION_SHEETS['sit-down'],
    },
  });
  registerPetSkin({
    id: 'skin-pet-adopt',
    defaultAnim: 'adopt-idle',
    sheets: {
      'adopt-idle': PET_ANIMATION_SHEETS['adopt-idle'],
    },
  });
};

registerBuiltinSkins();

export { PET_ANIMATION_SHEETS, registerAnimationSheet, registerBuiltinSkins };
