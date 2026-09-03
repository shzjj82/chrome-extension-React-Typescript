import type { PetMode, PetPhase } from '../types';

/**
 * 事件分类（只影响如何产生，不影响如何监听）：
 * - regular：宠物自行调度（run / idle）
 * - trigger：外部 fire（focus-sit / rest-prompt / 业务自定义）
 * - feedback：用户行为（hover / drag / click）
 */
type PetEventKind = 'regular' | 'trigger' | 'feedback';

/**
 * 默认生命周期。
 * - 行为/反馈：start → update → end
 * - 动画频道 anim：start → frame → complete（complete ≈ 单次动画结束）
 */
type PetEventLifecycle = 'start' | 'update' | 'frame' | 'complete' | 'end';

const DEFAULT_EVENT_LIFECYCLES: readonly PetEventLifecycle[] = ['start', 'update', 'end'];

const ANIM_EVENT_LIFECYCLES: readonly PetEventLifecycle[] = ['start', 'frame', 'complete', 'end'];

const FEEDBACK_EVENT_LIFECYCLES: readonly PetEventLifecycle[] = ['start', 'update', 'end'];

type PetPosition = {
  x: number;
  y: number;
};

type PetEventHookContext<TPayload = unknown> = {
  eventId: string;
  kind: PetEventKind;
  lifecycle: PetEventLifecycle;
  /** `${eventId}:${lifecycle}`，如 run:start、anim:frame */
  topic: string;
  position: PetPosition;
  facingLeft: boolean;
  mode: PetMode;
  motionPhase: PetPhase;
  payload?: TPayload;
  at: number;
};

type PetEventHook = (ctx: PetEventHookContext) => void;

/**
 * 监听主题：
 * - `*` 全部（默认不含 frame，避免刷屏）
 * - `*:*` 含 frame 的全部
 * - `run` / `run:start` / `anim:frame`
 */
type PetEventListenTopic = '*' | '*:*' | string;

type PetEventRuntime = {
  getSnapshot: () => Omit<PetEventHookContext, 'eventId' | 'kind' | 'lifecycle' | 'topic' | 'payload' | 'at'> & {
    at: number;
  };
  beginWalk: (options?: { preserveFacing?: boolean }) => void;
  enterIdle: (holdMs?: number) => void;
  lockSit: () => void;
  unlockSit: () => void;
  promptRestSit: () => void;
  clearRestPrompt: () => void;
};

type PetEventDefinition = {
  id: string;
  kind: PetEventKind;
  lifecycles?: readonly PetEventLifecycle[];
  weight?: number;
  builtin?: boolean;
  /** 行为事件关联的默认动画 id（皮肤表查询用，不等于事件本身） */
  animId?: string;
  execute?: (ctx: PetEventHookContext, runtime: PetEventRuntime) => void;
  onEnd?: (ctx: PetEventHookContext, runtime: PetEventRuntime) => void;
};

type PetEventRegisterOptions = {
  overwrite?: boolean;
};

/** 动画信号 payload */
type PetAnimSignalPayload = {
  animId: string;
  frame?: number;
  frames?: number;
  frameMs?: number;
  loop?: boolean;
};

export { ANIM_EVENT_LIFECYCLES, DEFAULT_EVENT_LIFECYCLES, FEEDBACK_EVENT_LIFECYCLES };

export type {
  PetAnimSignalPayload,
  PetEventDefinition,
  PetEventHook,
  PetEventHookContext,
  PetEventKind,
  PetEventLifecycle,
  PetEventListenTopic,
  PetEventRegisterOptions,
  PetEventRuntime,
  PetPosition,
};
