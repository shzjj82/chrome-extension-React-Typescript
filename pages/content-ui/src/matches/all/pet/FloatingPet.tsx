import { usePetBehavior } from './behavior/usePetBehavior';
import { PetView } from './ui/PetView';
import type { FloatingPetProps } from './types';

const FloatingPet = ({
  enabled = true,
  bounds,
  resumeDelayMs = 2200,
  walkSpeed = 54,
  resolveBubbleActions,
  ariaLabel = 'Study Mind 学习伙伴',
  controllerRef,
}: FloatingPetProps) => {
  const { rootRef, hoverZoneRef, hostRef, menuVisible, facingLeft, bubbleActions, handlers } = usePetBehavior({
    enabled,
    boundsProp: bounds,
    walkSpeed,
    resumeDelayMs,
    resolveBubbleActions,
    controllerRef,
  });

  const { enterHover, leaveHover, onPointerDown } = handlers;

  if (!enabled) {
    return null;
  }

  return (
    <PetView
      rootRef={rootRef}
      hoverZoneRef={hoverZoneRef}
      hostRef={hostRef}
      ariaLabel={ariaLabel}
      menuVisible={menuVisible}
      facingLeft={facingLeft}
      actions={bubbleActions}
      onEnterHover={enterHover}
      onLeaveHover={leaveHover}
      onPointerDown={onPointerDown}
    />
  );
};

export { FloatingPet };
