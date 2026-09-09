import { cn } from '@extension/ui';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

type SheetFrameProps = {
  title?: string;
  open: boolean;
  originX?: number;
  originY?: number;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 是否展示标题栏与「完成」；默认 true */
  showHeader?: boolean;
  className?: string;
  isLight?: boolean;
  /** 无标题时的无障碍名称 */
  ariaLabel?: string;
};

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.85;

/** 底部升起的面板（电话等） */
const SheetFrame = ({
  title,
  open,
  originX,
  originY,
  onClose,
  children,
  footer,
  showHeader = true,
  className,
  isLight = true,
  ariaLabel,
}: SheetFrameProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastAt: number;
    active: boolean;
    fromHandle: boolean;
  } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
      dragRef.current = null;
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const resetDrag = () => {
    dragRef.current = null;
    setDragging(false);
    setDragY(0);
  };

  const endDrag = (clientY: number) => {
    const drag = dragRef.current;
    if (!drag?.active) {
      resetDrag();
      return;
    }

    const delta = Math.max(0, clientY - drag.startY);
    const elapsed = Math.max(16, performance.now() - drag.lastAt);
    const velocity = (clientY - drag.lastY) / elapsed;

    if (delta >= DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      onClose();
      resetDrag();
      return;
    }

    resetDrag();
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: performance.now(),
      active: true,
      fromHandle: true,
    };
    setDragging(true);
  };

  const onBodyPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const body = bodyRef.current;
    if (!body || body.scrollTop > 0) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: performance.now(),
      active: false,
      fromHandle: false,
    };
  };

  const onFramePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const delta = event.clientY - drag.startY;
    if (!drag.active) {
      if (delta < 8) {
        return;
      }
      // 正文在顶部且向下拖，才接管为关闭手势
      const body = bodyRef.current;
      if (!drag.fromHandle && body && body.scrollTop > 0) {
        dragRef.current = null;
        return;
      }
      drag.active = true;
      setDragging(true);
      try {
        frameRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }

    drag.lastY = event.clientY;
    drag.lastAt = performance.now();
    setDragY(Math.max(0, delta));
  };

  const onFramePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    endDrag(event.clientY);
  };

  const label = ariaLabel || title || '面板';

  return (
    <div className={cn('sheet-layer', !isLight && 'sheet-layer--dark')} role="presentation">
      <button type="button" className="sheet-layer__backdrop" aria-label="关闭" onClick={onClose} />
      <div
        ref={frameRef}
        className={cn('sheet-frame', dragging && 'sheet-frame--dragging', className)}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onPointerMove={onFramePointerMove}
        onPointerUp={onFramePointerUp}
        onPointerCancel={onFramePointerUp}
        style={
          {
            transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
            ...(originX != null && originY != null
              ? {
                  '--sheet-ox': `${originX}px`,
                  '--sheet-oy': `${originY}px`,
                }
              : null),
          } as CSSProperties
        }>
        <div className="sheet-frame__handle" aria-hidden="true" onPointerDown={onHandlePointerDown} />
        {showHeader && title ? (
          <header className="sheet-frame__header">
            <h2 className="sheet-frame__title">{title}</h2>
            <button type="button" className="sheet-frame__close" onClick={onClose}>
              完成
            </button>
          </header>
        ) : null}
        <div ref={bodyRef} className="sheet-frame__body" onPointerDown={onBodyPointerDown}>
          {children}
        </div>
        {footer ? <div className="sheet-frame__footer">{footer}</div> : null}
      </div>
    </div>
  );
};

export default SheetFrame;
