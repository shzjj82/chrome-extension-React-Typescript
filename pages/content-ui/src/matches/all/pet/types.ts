import type { BubbleContentResolver } from './bubble/BubbleController';
import type { PetController } from './core/PetController';
import type { PetKindId } from './core/petKinds';
import type { PetEventDefinition, PetEventFireArgs, PetEventHook } from './events';
import type { ReactNode, RefObject } from 'react';

type PetBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** 用户交互模式：自动散步 / 悬停 / 拖拽 */
type PetMode = 'auto' | 'hover' | 'drag';

/** 移动阶段：休息 or 行走 */
type PetPhase = 'rest' | 'walk';

type PetInteractionAction = {
  id: string;
  label: string;
  headLine?: string;
  tailPrefix?: string;
  actionText?: string;
  trailingText?: string;
  /** 同行第二操作（如 休息 or 结束） */
  secondaryActionText?: string;
  onSecondarySelect?: () => void;
  secondaryAriaLabel?: string;
  secondaryTitle?: string;
  onSelect: () => void;
  ariaLabel?: string;
  title?: string;
};

type BubbleEventPayload = {
  actions: PetInteractionAction[];
  mode?: 'pinned' | 'temporary';
  durationMs?: number;
};

type LookClockPayload = {
  progress: number;
  percentLabel?: string;
};

/** 外部业务层：以事件 fire / 钩子为主（常规·触发·反馈监听同一套） */
type PetRuntimeApi = {
  /** 已知事件 id 带 payload 类型；自定义 id 为 unknown */
  fire: <K extends string>(eventId: K, ...args: PetEventFireArgs<K>) => boolean;
  endEvent: (eventId: string, payload?: unknown) => void;
  updateEvent: (eventId: string, payload?: unknown) => void;
  /** topic: '*' | '*:*' | 'run' | 'run:start' | 'drag:end' | 'anim:frame' ... */
  on: (topic: string, hook: PetEventHook) => () => void;
  onEvent: (eventId: string, hook: PetEventHook) => () => void;
  registerEvent: (def: PetEventDefinition) => void;
  getPosition: () => { x: number; y: number };
  promptRestReminder: (actions: PetInteractionAction[]) => void;
  clearRestReminder: () => void;
  showTemporaryBubble: (actions: PetInteractionAction[], durationMs?: number) => void;
};

type StageAccessoryContext = {
  facingLeft: boolean;
  menuVisible: boolean;
};

type StageAccessoryResolver = (ctx: StageAccessoryContext) => ReactNode;

type FloatingPetProps = {
  enabled?: boolean;
  bounds?: Partial<PetBounds>;
  resumeDelayMs?: number;
  walkSpeed?: number;
  kind?: PetKindId;
  resolveBubbleActions?: BubbleContentResolver;
  resolveStageAccessory?: StageAccessoryResolver;
  ariaLabel?: string;
  controllerRef?: RefObject<PetController | null>;
  onRuntimeReady?: (api: PetRuntimeApi | null) => void;
};

export type {
  BubbleEventPayload,
  FloatingPetProps,
  LookClockPayload,
  PetBounds,
  PetInteractionAction,
  PetMode,
  PetPhase,
  PetRuntimeApi,
  StageAccessoryContext,
  StageAccessoryResolver,
};
