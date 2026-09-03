import { PetBubbleMenu } from './bubble-menu/PetBubbleMenu';
import { PetHoverZone } from './hover/PetHoverZone';
import { PetRoot } from './root/PetRoot';
import { PetStage } from './stage/PetStage';
import type { PetInteractionAction } from '../types';
import type { ReactNode, RefObject, PointerEvent as ReactPointerEvent } from 'react';

type PetViewProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  hoverZoneRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  menuVisible: boolean;
  facingLeft: boolean;
  actions: PetInteractionAction[];
  /** 舞台附件（闹钟等），外部传入，与气泡解耦 */
  stageAccessory?: ReactNode;
  onEnterHover: () => void;
  onLeaveHover: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * 布局：气泡放在热区内，鼠标移向气泡不会触发 leave；
 * 显隐/文案仍由 BubbleController 驱动；舞台附件由外部传入。
 */
const PetView = ({
  rootRef,
  hoverZoneRef,
  hostRef,
  ariaLabel,
  menuVisible,
  facingLeft,
  actions,
  stageAccessory,
  onEnterHover,
  onLeaveHover,
  onPointerDown,
}: PetViewProps) => (
  <PetRoot rootRef={rootRef} ariaLabel={ariaLabel}>
    <PetHoverZone zoneRef={hoverZoneRef} onEnter={onEnterHover} onLeave={onLeaveHover} onPointerDown={onPointerDown}>
      <PetBubbleMenu visible={menuVisible} facingLeft={facingLeft} actions={actions} />
      <PetStage hostRef={hostRef} accessory={stageAccessory} />
    </PetHoverZone>
  </PetRoot>
);

export { PetView };
export type { PetViewProps };
