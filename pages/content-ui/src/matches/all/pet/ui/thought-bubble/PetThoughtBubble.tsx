import { getThoughtBubbleLayout } from './getThoughtBubbleLayout';
import { ThoughtBubbleShape } from './ThoughtBubbleShape';
import { useThoughtBubbleEnter } from './useThoughtBubbleEnter';
import type { CSSProperties, ReactNode } from 'react';

type PetThoughtBubbleProps = {
  visible: boolean;
  facingLeft: boolean;
  children?: ReactNode;
};

const PetThoughtBubble = ({ visible, facingLeft, children }: PetThoughtBubbleProps) => {
  const entered = useThoughtBubbleEnter(visible);

  if (!visible) {
    return null;
  }

  const { offsetX, tailNearDog } = getThoughtBubbleLayout(facingLeft);

  const bubbleStyle: CSSProperties = {
    opacity: entered ? 1 : 0,
    filter: entered ? 'brightness(1) saturate(1)' : 'brightness(1.45) saturate(0.72)',
    transform: `translateX(${offsetX}) scale(${entered ? 1 : 0.86})`,
  };

  return (
    <div
      className="sm-pet__thought sm-pet__thought--enter"
      style={bubbleStyle}
      aria-hidden={false}
      onPointerDown={event => {
        // 气泡内点击不触发宠物拖拽
        event.stopPropagation();
      }}>
      <ThoughtBubbleShape tailNearDog={tailNearDog} />
      {children}
    </div>
  );
};

export { PetThoughtBubble };
export type { PetThoughtBubbleProps };
