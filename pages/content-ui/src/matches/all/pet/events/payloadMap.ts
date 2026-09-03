import type { BubbleEventPayload, LookClockPayload } from '../types';
import type { PetAnimSignalPayload } from './types';

/** 反馈 / 拖拽 payload */
type PetDragPayload = {
  x?: number;
  y?: number;
  moved?: boolean;
};

type PetClickPayload = {
  x: number;
  y: number;
};

/**
 * 已知事件 payload 映射（自定义事件仍可用 unknown）。
 * 使用：`(ctx.payload as PetEventPayloadMap['drag'] | undefined)`
 */
type PetEventPayloadMap = {
  walk: undefined;
  idle: undefined;
  hover: undefined;
  drag: PetDragPayload;
  click: PetClickPayload;
  'focus-sit': undefined;
  'rest-prompt': undefined;
  run: undefined;
  eat: undefined;
  anim: PetAnimSignalPayload;
  'look-clock': LookClockPayload;
  bubble: BubbleEventPayload;
};

/** fire 参数：已知 id 带 payload 类型；未知 id 为 unknown */
type PetEventFireArgs<K extends string> = K extends keyof PetEventPayloadMap
  ? PetEventPayloadMap[K] extends undefined
    ? []
    : [payload?: PetEventPayloadMap[K]]
  : [payload?: unknown];

export type { PetClickPayload, PetDragPayload, PetEventFireArgs, PetEventPayloadMap };
