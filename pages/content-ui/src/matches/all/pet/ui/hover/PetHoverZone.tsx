import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';

type PetHoverZoneProps = {
  zoneRef: RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

/** 悬浮 / 指针交互热区，负责 mouseenter、mouseleave、pointerdown */
const PetHoverZone = ({ zoneRef, onEnter, onLeave, onPointerDown, children }: PetHoverZoneProps) => (
  <div
    ref={zoneRef}
    className="sm-pet__hover-zone"
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    onPointerDown={onPointerDown}>
    {children}
  </div>
);

export { PetHoverZone };
export type { PetHoverZoneProps };
