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
 * 布局：气泡放在热区内，鼠标移向气泡不会触发 leave；
 * 显隐/文案仍由 BubbleController 驱动（逻辑解耦，DOM 同热区）。
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
      <PetBubbleMenu visible={menuVisible} facingLeft={facingLeft} actions={actions} />
      <PetStage hostRef={hostRef} />
    </PetHoverZone>
  </PetRoot>
);

export { PetView };
export type { PetViewProps };
