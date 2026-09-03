/**
 * 绑定窗口级 pointer 监听，返回 detach。
 * 用于拖拽：热区 capture 后仍需在 window 上收 move/up。
 */
const attachWindowPointerSession = (
  pointerId: number,
  handlers: {
    onMove: (clientX: number, clientY: number) => void;
    onEnd: (endedPointerId: number) => void;
  },
): (() => void) => {
  const onMove = (e: PointerEvent) => {
    if (e.pointerId === pointerId) {
      handlers.onMove(e.clientX, e.clientY);
    }
  };
  const onEnd = (e: PointerEvent) => {
    if (e.pointerId === pointerId) {
      handlers.onEnd(pointerId);
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };
};

export { attachWindowPointerSession };
