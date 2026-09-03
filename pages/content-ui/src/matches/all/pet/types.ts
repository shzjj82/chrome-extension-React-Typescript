import type { BubbleContentResolver } from './bubble/BubbleController';
import type { PetController } from './core/PetController';
import type { PetKindId } from './core/petKinds';
import type { RefObject } from 'react';

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

type FloatingPetProps = {
  enabled?: boolean;
  bounds?: Partial<PetBounds>;
  resumeDelayMs?: number;
  walkSpeed?: number;
  /** 宠物种类：认养前用 adoptable-pup */
  kind?: PetKindId;
  /** 气泡文案解析：气泡层自管显隐，内容由此回调提供 */
  resolveBubbleActions?: BubbleContentResolver;
  ariaLabel?: string;
  /** 宠物实例引用，创建后可通过 subscribe / unsubscribe 订阅消息 */
  controllerRef?: RefObject<PetController | null>;
  /** 专注结束后狗狗坐下提醒休息（默认开启） */
  enableFocusRestReminder?: boolean;
};

export type { FloatingPetProps, PetBounds, PetInteractionAction, PetMode, PetPhase };
