import { getThoughtBubbleGeometry, THOUGHT_BUBBLE_SM } from './thoughtBubbleGeometry';
import type { ThoughtBubbleSize } from './thoughtBubbleGeometry';

type ThoughtBubbleLayout = {
  /** 相对宠物中心（left:50%）的水平位移，单位 px */
  offsetX: number;
  /** 相对宠物底部的 bottom，单位 px；锚定小圆点高度与 sm 一致 */
  bottom: number;
  tailNearDog: 'left' | 'right';
};

/** sm 时小圆点相对宠物中心的水平偏移（保持历史观感） */
const SM_SMALL_DOT_OFFSET_FROM_CENTER =
  -THOUGHT_BUBBLE_SM.viewBox.width / 2 - 18 + THOUGHT_BUBBLE_SM.smallDot.cx; /* facingLeft: -54 - 18 + 94 = 22 */

/** sm 时小圆点相对宠物底边的高度（bottom:68 + 距壳底间隙） */
const SM_SMALL_DOT_FROM_PET_BOTTOM = 68 + (THOUGHT_BUBBLE_SM.viewBox.height - THOUGHT_BUBBLE_SM.smallDot.cy);

/**
 * 各尺寸共用「小圆点」锚点，使 md/lg 放大后气泡仍落在 sm 的历史位置。
 */
const getThoughtBubbleLayout = (facingLeft: boolean, size: ThoughtBubbleSize = 'sm'): ThoughtBubbleLayout => {
  const { viewBox, smallDot } = getThoughtBubbleGeometry(size);
  const tailNearDog = facingLeft ? 'right' : 'left';

  // 翻转时小圆点视觉 x = width - cx
  const visualDotX = facingLeft ? smallDot.cx : viewBox.width - smallDot.cx;
  const targetFromCenter = facingLeft ? SM_SMALL_DOT_OFFSET_FROM_CENTER : -SM_SMALL_DOT_OFFSET_FROM_CENTER;
  // left:50% + translateX(offsetX) + visualDotX = 50% + targetFromCenter
  const offsetX = targetFromCenter - visualDotX;

  const gapBelowDot = viewBox.height - smallDot.cy;
  const bottom = SM_SMALL_DOT_FROM_PET_BOTTOM - gapBelowDot;

  return { offsetX, bottom, tailNearDog };
};

export type { ThoughtBubbleLayout };
export { getThoughtBubbleLayout };
