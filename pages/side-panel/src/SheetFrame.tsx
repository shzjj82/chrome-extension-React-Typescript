import { cn } from '@extension/ui';
import type { CSSProperties, ReactNode } from 'react';

type SheetFrameProps = {
  title: string;
  open: boolean;
  originX?: number;
  originY?: number;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  isLight?: boolean;
};

/** 底部升起的面板（电话等） */
const SheetFrame = ({
  title,
  open,
  originX,
  originY,
  onClose,
  children,
  className,
  isLight = true,
}: SheetFrameProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className={cn('sheet-layer', !isLight && 'sheet-layer--dark')} role="presentation">
      <button type="button" className="sheet-layer__backdrop" aria-label="关闭" onClick={onClose} />
      <div
        className={cn('sheet-frame', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={
          originX != null && originY != null
            ? ({
                '--sheet-ox': `${originX}px`,
                '--sheet-oy': `${originY}px`,
              } as CSSProperties)
            : undefined
        }>
        <div className="sheet-frame__handle" aria-hidden="true" />
        <header className="sheet-frame__header">
          <h2 className="sheet-frame__title">{title}</h2>
          <button type="button" className="sheet-frame__close" onClick={onClose}>
            完成
          </button>
        </header>
        <div className="sheet-frame__body">{children}</div>
      </div>
    </div>
  );
};

export default SheetFrame;
