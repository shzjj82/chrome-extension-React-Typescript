import { cn } from '@extension/ui';
import { X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

type BrowserFrameProps = {
  title: string;
  url: string;
  originX?: number;
  originY?: number;
  open: boolean;
  /** 认养等场景可不提供关闭 */
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** 是否允许点遮罩关闭 */
  dismissible?: boolean;
  isLight?: boolean;
};

/** 桌面之上的浏览器弹窗（认养 / 浏览器 / 商店等）——地址栏只展示，不可编辑 */
const BrowserFrame = ({
  title,
  url,
  originX,
  originY,
  open,
  onClose,
  children,
  className,
  dismissible = true,
  isLight = true,
}: BrowserFrameProps) => {
  if (!open) {
    return null;
  }

  const canClose = Boolean(onClose);
  const displayUrl = url.trim() || 'study.mind';

  return (
    <div className={cn('browser-layer', !isLight && 'browser-layer--dark')} role="presentation">
      {dismissible && canClose ? (
        <button type="button" className="browser-layer__backdrop" aria-label="关闭浏览器" onClick={onClose} />
      ) : (
        <div className="browser-layer__backdrop browser-layer__backdrop--static" aria-hidden="true" />
      )}
      <div
        className={cn('browser-frame', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={
          originX != null && originY != null
            ? ({
                '--browser-ox': `${originX}px`,
                '--browser-oy': `${originY}px`,
              } as CSSProperties)
            : undefined
        }>
        <header className="browser-frame__chrome">
          <div className="browser-frame__address">
            <span className="browser-frame__url-text" title={displayUrl}>
              {displayUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
          {canClose ? (
            <button type="button" className="browser-frame__close" onClick={onClose} aria-label="关闭">
              <X size={16} strokeWidth={2.2} />
            </button>
          ) : null}
        </header>
        <div className="browser-frame__body">{children}</div>
      </div>
    </div>
  );
};

export default BrowserFrame;
