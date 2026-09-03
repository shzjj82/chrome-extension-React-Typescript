import { registerPetSkin, registerSkinSheet } from './skins';
import adoptIdleSheetUrl from '../assets/adopt-idle.png';
import eatSheetUrl from '../assets/eat.png';
import runSheetUrl from '../assets/run.png';
import sitSheetUrl from '../assets/sit.png';
import walkSheetUrl from '../assets/walk.png';
import type { AnimationSheetDef, BuiltinPetAnimId } from './types';

/**
 * 兼容旧全局表：默认皮肤的 sheet 镜像。
 * 新代码请优先 registerPetSkin / getSkinSheet。
 */
const PET_ANIMATION_SHEETS: Record<BuiltinPetAnimId, AnimationSheetDef> = {
  walk: { url: walkSheetUrl, frames: 8, frameMs: 120, loop: true },
  run: { url: runSheetUrl, frames: 8, frameMs: 90, loop: true },
  sit: { url: sitSheetUrl, frames: 2, frameMs: 280, loop: false },
  eat: { url: eatSheetUrl, frames: 8, frameMs: 110, loop: false },
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
    defaultAnim: 'walk',
    sheets: {
      walk: PET_ANIMATION_SHEETS.walk,
      run: PET_ANIMATION_SHEETS.run,
      sit: PET_ANIMATION_SHEETS.sit,
      eat: PET_ANIMATION_SHEETS.eat,
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
