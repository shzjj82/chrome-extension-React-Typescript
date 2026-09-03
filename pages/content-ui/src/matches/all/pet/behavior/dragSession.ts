import { DRAG_THRESHOLD, DRAG_VIEW_MARGIN, VIEW_SIZE } from '../constants';
import { clamp } from '../utils/bounds';

type DragSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const createDragSession = (
  pointerId: number,
  clientX: number,
  clientY: number,
  originX: number,
  originY: number,
): DragSession => ({
  pointerId,
  startClientX: clientX,
  startClientY: clientY,
  originX,
  originY,
  moved: false,
});

/** 返回下一帧位置；未过阈值则 null */
const computeDragPosition = (drag: DragSession, clientX: number, clientY: number): { x: number; y: number } | null => {
  const dx = clientX - drag.startClientX;
  const dy = clientY - drag.startClientY;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
    return null;
  }
  drag.moved = true;
  const maxX = window.innerWidth - DRAG_VIEW_MARGIN - VIEW_SIZE;
  const maxY = window.innerHeight - DRAG_VIEW_MARGIN - VIEW_SIZE;
  return {
    x: clamp(drag.originX + dx, DRAG_VIEW_MARGIN, Math.max(DRAG_VIEW_MARGIN, maxX)),
    y: clamp(drag.originY + dy, DRAG_VIEW_MARGIN, Math.max(DRAG_VIEW_MARGIN, maxY)),
  };
};

export { computeDragPosition, createDragSession };
export type { DragSession };
