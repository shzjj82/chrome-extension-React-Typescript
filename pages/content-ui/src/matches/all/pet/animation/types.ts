type PetAnimId = string;

type AnimationSheetDef = {
  url: string;
  frames: number;
  frameMs: number;
  loop: boolean;
  /** 源图单帧边长（px），默认 96 */
  sourceFrame?: number;
};

type PetAnimationStartEvent = {
  type: 'start';
  anim: PetAnimId;
  frame: number;
  frames: number;
  frameMs: number;
  loop: boolean;
};

type PetAnimationFrameEvent = {
  type: 'frame';
  anim: PetAnimId;
  frame: number;
  frames: number;
};

type PetAnimationCompleteEvent = {
  type: 'complete';
  anim: PetAnimId;
  frames: number;
};

type PetAnimationEvent = PetAnimationStartEvent | PetAnimationFrameEvent | PetAnimationCompleteEvent;

type PetAnimationEventHandler = (event: PetAnimationEvent) => void;

/** 已知内置动画 id（皮肤仍可用任意 string） */
type BuiltinPetAnimId = 'run' | 'sit' | 'sit-down' | 'adopt-idle';

export type {
  AnimationSheetDef,
  BuiltinPetAnimId,
  PetAnimId,
  PetAnimationCompleteEvent,
  PetAnimationEvent,
  PetAnimationEventHandler,
  PetAnimationFrameEvent,
  PetAnimationStartEvent,
};
