import { usePetBehavior } from './behavior/usePetBehavior';
import { PetView } from './ui/PetView';
import { useEffect, useMemo, useRef } from 'react';
import type { FloatingPetProps, PetRuntimeApi } from './types';

const FloatingPet = ({
  enabled = true,
  bounds,
  resumeDelayMs = 2200,
  walkSpeed = 54,
  kind = 'study-buddy',
  resolveBubbleActions,
  resolveStageAccessory,
  ariaLabel = 'Study Mind 陪伴伙伴',
  controllerRef,
  onRuntimeReady,
}: FloatingPetProps) => {
  const { rootRef, hoverZoneRef, hostRef, menuVisible, facingLeft, bubbleActions, handlers } = usePetBehavior({
    enabled,
    boundsProp: bounds,
    walkSpeed,
    resumeDelayMs,
    kind,
    resolveBubbleActions,
    controllerRef,
  });

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const runtimeApi = useMemo<PetRuntimeApi>(
    () => ({
      fire: ((...args: Parameters<PetRuntimeApi['fire']>) =>
        handlersRef.current.fire(...args)) as PetRuntimeApi['fire'],
      endEvent: (eventId, payload) => handlersRef.current.endEvent(eventId, payload),
      updateEvent: (eventId, payload) => handlersRef.current.updateEvent(eventId, payload),
      on: (topic, hook) => handlersRef.current.onPetEvent(topic, hook) ?? (() => undefined),
      onEvent: (eventId, hook) => handlersRef.current.onPetEventId(eventId, hook) ?? (() => undefined),
      registerEvent: def => handlersRef.current.registerPetEvent(def),
      getPosition: () => handlersRef.current.getPosition(),
      promptRestReminder: actions => handlersRef.current.promptRestReminder(actions),
      clearRestReminder: () => handlersRef.current.clearRestReminder(),
      showTemporaryBubble: (actions, durationMs) => handlersRef.current.showTemporaryBubble(actions, durationMs),
    }),
    [],
  );

  useEffect(() => {
    if (!enabled) {
      onRuntimeReady?.(null);
      return;
    }
    onRuntimeReady?.(runtimeApi);
    return () => onRuntimeReady?.(null);
  }, [enabled, onRuntimeReady, runtimeApi]);

  if (!enabled) {
    return null;
  }

  const stageAccessory = resolveStageAccessory?.({ facingLeft, menuVisible }) ?? null;

  return (
    <PetView
      rootRef={rootRef}
      hoverZoneRef={hoverZoneRef}
      hostRef={hostRef}
      ariaLabel={ariaLabel}
      menuVisible={menuVisible}
      facingLeft={facingLeft}
      actions={bubbleActions}
      stageAccessory={stageAccessory}
      onEnterHover={handlers.enterHover}
      onLeaveHover={handlers.leaveHover}
      onPointerDown={handlers.onPointerDown}
    />
  );
};

export { FloatingPet };
