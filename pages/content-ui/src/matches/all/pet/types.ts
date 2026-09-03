import type { BubbleContentResolver } from './bubble/BubbleController';
import type { PetController } from './core/PetController';
import type { PetKindId } from './core/petKinds';
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
  /** 认养：第一行普通文案 */
  headLine?: string;
  /** 认养：第二行按钮前的普通文案 */
  tailPrefix?: string;
  /** 认养：可点击 action（如「认养」） */
  actionText?: string;
  /** 认养：第二行按钮后的普通文案 */
  trailingText?: string;
  onSelect: () => void;
  ariaLabel?: string;
  title?: string;
};

/** 外部业务层可调用的宠物运行时能力（类似气泡由外部驱动） */
type PetRuntimeApi = {
  lockSit: () => void;
  unlockSit: () => void;
  promptRestReminder: (actions: PetInteractionAction[]) => void;
  clearRestReminder: () => void;
  showTemporaryBubble: (actions: PetInteractionAction[], durationMs?: number) => void;
};

type StageAccessoryContext = {
  facingLeft: boolean;
  /** 气泡可见时，外部应隐藏闹钟等附件 */
  menuVisible: boolean;
};

type StageAccessoryResolver = (ctx: StageAccessoryContext) => ReactNode;

type FloatingPetProps = {
  enabled?: boolean;
  bounds?: Partial<PetBounds>;
  resumeDelayMs?: number;
  walkSpeed?: number;
  /** 宠物种类：认养前用 adoptable-pup */
  kind?: PetKindId;
  /** 气泡文案解析：气泡层自管显隐，内容由此回调提供 */
  resolveBubbleActions?: BubbleContentResolver;
  /**
   * 舞台附件解析（如专注闹钟），由外部传入，类似气泡。
   * 与气泡互斥：ctx.menuVisible 为 true 时应返回 null。
   */
  resolveStageAccessory?: StageAccessoryResolver;
  ariaLabel?: string;
  /** 宠物实例引用，创建后可通过 subscribe / unsubscribe 订阅消息 */
  controllerRef?: RefObject<PetController | null>;
  /** 运行时 API 就绪回调，供外部专注/休息等业务挂接 */
  onRuntimeReady?: (api: PetRuntimeApi | null) => void;
};

export type {
  FloatingPetProps,
  PetBounds,
  PetInteractionAction,
  PetMode,
  PetPhase,
  PetRuntimeApi,
  StageAccessoryContext,
  StageAccessoryResolver,
};
