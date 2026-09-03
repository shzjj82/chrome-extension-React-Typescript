import adoptIdleSheetUrl from '../assets/adopt-idle.png';
import runSheetUrl from '../assets/run.png';
import sitDownSheetUrl from '../assets/sit-down.png';
import sitSheetUrl from '../assets/sit.png';
import type { AnimationSheetDef, PetAnimId } from './types';

/** 内置动画表；后续新动画在此注册即可 */
const PET_ANIMATION_SHEETS: Record<PetAnimId, AnimationSheetDef> = {
  run: { url: runSheetUrl, frames: 5, frameMs: 90, loop: true },
  sit: { url: sitSheetUrl, frames: 8, frameMs: 220, loop: false },
  'sit-down': { url: sitDownSheetUrl, frames: 4, frameMs: 110, loop: false },
  /** 认养小狗：坐着喘气 / 叫一声 / 摇尾巴，循环 */
  'adopt-idle': { url: adoptIdleSheetUrl, frames: 8, frameMs: 140, loop: true, sourceFrame: 198 },
};

const registerAnimationSheet = (id: PetAnimId, sheet: AnimationSheetDef) => {
  PET_ANIMATION_SHEETS[id] = sheet;
};

export { PET_ANIMATION_SHEETS, registerAnimationSheet };
