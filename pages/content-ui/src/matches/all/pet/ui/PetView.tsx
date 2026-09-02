import { PetBubbleMenu } from './bubble-menu/PetBubbleMenu';
import { PetHoverZone } from './hover/PetHoverZone';
import { PetRoot } from './root/PetRoot';
import { PetStage } from './stage/PetStage';
import type { PetInteractionAction } from '../types';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';

type PetViewProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  hoverZoneRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  menuVisible: boolean;
  facingLeft: boolean;
  actions: PetInteractionAction[];
  onEnterHover: () => void;
  onLeaveHover: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * 布局：热区只包舞台（hover → 动画事件）；
 * 气泡为兄弟节点，由 BubbleController 驱动显隐与文案。
 */
const PetView = ({
  rootRef,
  hoverZoneRef,
  hostRef,
  ariaLabel,
  menuVisible,
  facingLeft,
  actions,
  onEnterHover,
  onLeaveHover,
  onPointerDown,
}: PetViewProps) => (
  <PetRoot rootRef={rootRef} ariaLabel={ariaLabel}>
    <PetHoverZone zoneRef={hoverZoneRef} onEnter={onEnterHover} onLeave={onLeaveHover} onPointerDown={onPointerDown}>
      <PetStage hostRef={hostRef} />
    </PetHoverZone>
    <PetBubbleMenu visible={menuVisible} facingLeft={facingLeft} actions={actions} />
  </PetRoot>
);

export { PetView };
export type { PetViewProps };
