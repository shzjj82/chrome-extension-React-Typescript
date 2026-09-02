type PetAnimId = 'run' | 'sit' | 'sit-down';

type AnimationSheetDef = {
  url: string;
  frames: number;
  frameMs: number;
  loop: boolean;
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

export type {
  AnimationSheetDef,
  PetAnimId,
  PetAnimationCompleteEvent,
  PetAnimationEvent,
  PetAnimationEventHandler,
  PetAnimationFrameEvent,
  PetAnimationStartEvent,
};
