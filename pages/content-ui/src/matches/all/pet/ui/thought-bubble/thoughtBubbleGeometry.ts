type ThoughtBubbleSize = 'sm' | 'md' | 'lg';

type ThoughtBubbleViewBox = {
  width: number;
  height: number;
};

type ThoughtBubbleDot = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type ThoughtBubbleSmallDot = {
  cx: number;
  cy: number;
  r: number;
};

type ThoughtBubbleGeometry = {
  size: ThoughtBubbleSize;
  viewBox: ThoughtBubbleViewBox;
  cloudPath: string;
  midDot: ThoughtBubbleDot;
  smallDot: ThoughtBubbleSmallDot;
};

/** sm：沿用现有造型 */
const THOUGHT_BUBBLE_SM: ThoughtBubbleGeometry = {
  size: 'sm',
  viewBox: { width: 108, height: 88 },
  cloudPath:
    'M24 50 C14 50 10 36 18 28 C22 16 36 12 46 16 C54 9 68 11 76 20 C86 17 94 27 91 38 C98 45 93 55 83 58 C81 65 68 68 56 66 C44 69 30 64 24 56 Z',
  midDot: { cx: 84, cy: 68, rx: 6.5, ry: 4.8 },
  smallDot: { cx: 94, cy: 80, r: 3.2 },
};

/**
 * md：主云放大，下沿与右下留给两点（不遮挡）。
 * path 由 sm 约 1.28× 缩放并微移得到。
 */
const THOUGHT_BUBBLE_MD: ThoughtBubbleGeometry = {
  size: 'md',
  viewBox: { width: 140, height: 110 },
  cloudPath:
    'M34.7 62 C21.9 62 16.8 44.1 27 33.8 C32.2 18.5 50.1 13.4 62.9 18.5 C73.1 9.5 91 12.1 101.3 23.6 C114.1 19.8 124.3 32.6 120.5 46.6 C129.4 55.6 123 68.4 110.2 72.2 C107.7 81.2 91 85 75.7 82.5 C60.3 86.3 42.4 79.9 34.7 69.7 Z',
  midDot: { cx: 112, cy: 92, rx: 7.5, ry: 5.5 },
  smallDot: { cx: 126, cy: 104, r: 3.6 },
};

/**
 * lg：更大主云，点仍锚在 viewBox 右下角空隙。
 */
const THOUGHT_BUBBLE_LG: ThoughtBubbleGeometry = {
  size: 'lg',
  viewBox: { width: 168, height: 128 },
  cloudPath:
    'M42.5 72 C27.3 72 21.2 50.7 33.4 38.6 C39.4 20.3 60.7 14.2 75.9 20.3 C88.1 9.7 109.4 12.7 121.5 26.4 C136.7 21.8 148.9 37 144.3 53.8 C155 64.4 147.4 79.6 132.2 84.2 C129.1 94.8 109.4 99.4 91.1 96.3 C72.9 100.9 51.6 93.3 42.5 81.1 Z',
  midDot: { cx: 134, cy: 108, rx: 8.5, ry: 6.2 },
  smallDot: { cx: 150, cy: 120, r: 4 },
};

const THOUGHT_BUBBLE_BY_SIZE: Record<ThoughtBubbleSize, ThoughtBubbleGeometry> = {
  sm: THOUGHT_BUBBLE_SM,
  md: THOUGHT_BUBBLE_MD,
  lg: THOUGHT_BUBBLE_LG,
};

/** @deprecated 兼容旧导出名：等同 sm */
const THOUGHT_BUBBLE_VIEWBOX = THOUGHT_BUBBLE_SM.viewBox;
/** @deprecated 兼容旧导出名：等同 sm */
const THOUGHT_BUBBLE_CLOUD_PATH = THOUGHT_BUBBLE_SM.cloudPath;

const getThoughtBubbleGeometry = (size: ThoughtBubbleSize = 'sm'): ThoughtBubbleGeometry =>
  THOUGHT_BUBBLE_BY_SIZE[size];

export {
  getThoughtBubbleGeometry,
  THOUGHT_BUBBLE_BY_SIZE,
  THOUGHT_BUBBLE_CLOUD_PATH,
  THOUGHT_BUBBLE_VIEWBOX,
  THOUGHT_BUBBLE_SM,
  THOUGHT_BUBBLE_MD,
  THOUGHT_BUBBLE_LG,
};
export type { ThoughtBubbleDot, ThoughtBubbleGeometry, ThoughtBubbleSize, ThoughtBubbleSmallDot, ThoughtBubbleViewBox };
