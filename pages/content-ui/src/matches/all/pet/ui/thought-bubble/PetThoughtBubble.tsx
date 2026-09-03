import { getThoughtBubbleContentRect } from './getThoughtBubbleContentRect';
import { getThoughtBubbleLayout } from './getThoughtBubbleLayout';
import { getThoughtBubbleGeometry } from './thoughtBubbleGeometry';
import { ThoughtBubbleShape } from './ThoughtBubbleShape';
import { useThoughtBubbleEnter } from './useThoughtBubbleEnter';
import { useThoughtBubbleOverflow } from './useThoughtBubbleOverflow';
import { useRef } from 'react';
import type { ThoughtBubbleSize } from './thoughtBubbleGeometry';
import type { CSSProperties, ReactNode } from 'react';

type PetThoughtBubbleProps = {
  visible: boolean;
  facingLeft: boolean;
  size?: ThoughtBubbleSize;
  children?: ReactNode;
};

const PetThoughtBubble = ({ visible, facingLeft, size = 'sm', children }: PetThoughtBubbleProps) => {
  const entered = useThoughtBubbleEnter(visible);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const truncated = useThoughtBubbleOverflow(bodyRef, contentRef, [size, visible, entered, children]);

  if (!visible) {
    return null;
  }

  const { offsetX, bottom, tailNearPet } = getThoughtBubbleLayout(facingLeft, size);
  const { viewBox } = getThoughtBubbleGeometry(size);
  // SVG 翻转时文案区需同步镜像，否则 md/lg 会明显偏到一侧
  const contentRect = getThoughtBubbleContentRect({
    size,
    mirrorX: tailNearPet === 'left',
  });

  const bubbleStyle: CSSProperties = {
    width: viewBox.width,
    height: viewBox.height,
    bottom,
    opacity: entered ? 1 : 0,
    filter: entered ? 'brightness(1) saturate(1)' : 'brightness(1.45) saturate(0.72)',
    transform: `translateX(${offsetX}px) scale(${entered ? 1 : 0.86})`,
  };

  const bodyStyle: CSSProperties = {
    top: contentRect.top,
    left: contentRect.left,
    width: contentRect.width,
    height: contentRect.height,
    transform: 'none',
  };

  return (
    <div
      className="sm-pet__thought sm-pet__thought--enter"
      data-size={size}
      style={bubbleStyle}
      aria-hidden={false}
      onPointerDown={event => {
        // 气泡内点击不触发宠物拖拽
        event.stopPropagation();
      }}>
      <ThoughtBubbleShape tailNearPet={tailNearPet} size={size} />
      <div ref={bodyRef} className="sm-pet__thought-body" style={bodyStyle}>
        <div ref={contentRef} className="sm-pet__thought-body-inner">
          {children}
        </div>
        {truncated ? (
          <span className="sm-pet__thought-ellipsis" aria-hidden="true">
            ...
          </span>
        ) : null}
      </div>
    </div>
  );
};

export { PetThoughtBubble };
export type { PetThoughtBubbleProps };
