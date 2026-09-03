import type { ThoughtBubbleSize } from './thoughtBubbleGeometry';
import type { PetInteractionAction } from '../../types';

/** 超过该「视觉字符量」升到 md */
const MD_THRESHOLD = 8;
/** 超过该量升到 lg（结构化长文案如认养 / 专注状态） */
const LG_THRESHOLD = 11;

/** CJK 偏宽，按 1；ASCII 按 0.55 估算 */
const estimateVisualLength = (text: string): number => {
  let total = 0;
  for (const char of text) {
    if (/\s/.test(char)) {
      total += 0.25;
      continue;
    }
    total += /[\u3400-\u9fff]/.test(char) ? 1 : 0.55;
  }
  return total;
};

const collectActionText = (action: PetInteractionAction): string => {
  if (action.headLine && action.actionText) {
    return [action.headLine, action.tailPrefix, action.actionText, action.secondaryActionText, action.trailingText]
      .filter(Boolean)
      .join('');
  }
  return action.label;
};

/**
 * 按气泡可见文案量选择 sm / md / lg。
 * 多 action 时累加（含 or 分隔的粗略开销）。
 */
const resolveThoughtBubbleSize = (actions: PetInteractionAction[]): ThoughtBubbleSize => {
  if (actions.length === 0) {
    return 'sm';
  }

  let units = 0;
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (!action) {
      continue;
    }
    if (index > 0) {
      units += 2; // " or "
    }
    units += estimateVisualLength(collectActionText(action));
  }

  if (units > LG_THRESHOLD) {
    return 'lg';
  }
  if (units > MD_THRESHOLD) {
    return 'md';
  }
  return 'sm';
};

const THOUGHT_BUBBLE_SIZE_RANK: Record<ThoughtBubbleSize, number> = {
  sm: 0,
  md: 1,
  lg: 2,
};

const nextThoughtBubbleSize = (size: ThoughtBubbleSize): ThoughtBubbleSize | null => {
  if (size === 'sm') {
    return 'md';
  }
  if (size === 'md') {
    return 'lg';
  }
  return null;
};

const maxThoughtBubbleSize = (a: ThoughtBubbleSize, b: ThoughtBubbleSize): ThoughtBubbleSize =>
  THOUGHT_BUBBLE_SIZE_RANK[a] >= THOUGHT_BUBBLE_SIZE_RANK[b] ? a : b;

export {
  MD_THRESHOLD,
  LG_THRESHOLD,
  resolveThoughtBubbleSize,
  estimateVisualLength,
  nextThoughtBubbleSize,
  maxThoughtBubbleSize,
};
