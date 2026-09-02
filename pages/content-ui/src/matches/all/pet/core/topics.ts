import type { PetAnimationEvent, PetAnimId } from '../animation/types';
import type { PetMode, PetPhase } from '../types';

type PetAnimPhase = 'start' | 'frame' | 'complete';

type PetAnimStartPayload = {
  frame: number;
  frames: number;
  frameMs: number;
  loop: boolean;
};

type PetAnimFramePayload = {
  frame: number;
  frames: number;
};

type PetAnimCompletePayload = {
  frames: number;
};

type PetBehaviorStartPayload = {
  mode: PetMode;
  phase: PetPhase;
};

type PetEmptyPayload = undefined;

type PetFacingPayload = {
  facingLeft: boolean;
};

type PetBubblePayload = {
  visible: boolean;
};

type PetAnimTopic = `${PetAnimId}:${PetAnimPhase}`;

type PetBehaviorTopic = 'idle:start' | 'walk:start';

type PetInteractionTopic = 'hover:enter' | 'hover:leave' | 'drag:start' | 'drag:end';

type PetFacingTopic = 'facing:change';

type PetBubbleTopic = 'bubble:show' | 'bubble:hide';

/** 汇总频道：animation 任意动画变化；state 行为快照（不含气泡） */
type PetAggregateTopic = 'animation' | 'state';

type PetTopic =
  | PetAnimTopic
  | PetBehaviorTopic
  | PetInteractionTopic
  | PetFacingTopic
  | PetBubbleTopic
  | PetAggregateTopic;

type PetControllerState = {
  facingLeft: boolean;
  mode: PetMode;
  phase: PetPhase;
};

type PetTopicPayload = {
  animation: PetAnimationEvent;
  state: PetControllerState;
  'idle:start': PetBehaviorStartPayload;
  'walk:start': PetBehaviorStartPayload;
  'hover:enter': PetEmptyPayload;
  'hover:leave': PetEmptyPayload;
  'drag:start': PetEmptyPayload;
  'drag:end': PetEmptyPayload;
  'facing:change': PetFacingPayload;
  'bubble:show': PetBubblePayload;
  'bubble:hide': PetBubblePayload;
} & {
  [K in PetAnimId as `${K}:start`]: PetAnimStartPayload;
} & {
  [K in PetAnimId as `${K}:frame`]: PetAnimFramePayload;
} & {
  [K in PetAnimId as `${K}:complete`]: PetAnimCompletePayload;
};

type PetPublish = <T extends PetTopic>(topic: T, payload: PetTopicPayload[T]) => void;

const animTopic = <A extends PetAnimId, P extends PetAnimPhase>(anim: A, phase: P): `${A}:${P}` => `${anim}:${phase}`;

export { animTopic };
export type {
  PetAggregateTopic,
  PetAnimCompletePayload,
  PetAnimFramePayload,
  PetAnimPhase,
  PetAnimStartPayload,
  PetAnimTopic,
  PetBehaviorStartPayload,
  PetBehaviorTopic,
  PetBubblePayload,
  PetBubbleTopic,
  PetControllerState,
  PetEmptyPayload,
  PetFacingPayload,
  PetFacingTopic,
  PetInteractionTopic,
  PetPublish,
  PetTopic,
  PetTopicPayload,
};
