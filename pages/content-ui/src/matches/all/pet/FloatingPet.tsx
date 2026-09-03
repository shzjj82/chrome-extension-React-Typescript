import { usePetBehavior } from './behavior/usePetBehavior';
import { createRestReminderAction } from './interactions/studyMindActions';
import { PetView } from './ui/PetView';
import { useStorage } from '@extension/shared';
import { pomodoroStateStorage } from '@extension/storage';
import { useEffect, useRef } from 'react';
import type { FloatingPetProps } from './types';
import type { PomodoroPhase } from '@extension/storage';

const FloatingPet = ({
  enabled = true,
  bounds,
  resumeDelayMs = 2200,
  walkSpeed = 54,
  kind = 'study-buddy',
  resolveBubbleActions,
  ariaLabel = 'Study Mind 陪伴伙伴',
  controllerRef,
  enableFocusRestReminder = true,
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

  const { enterHover, leaveHover, onPointerDown, promptRestReminder, clearRestReminder } = handlers;
  const promptRestReminderRef = useRef(promptRestReminder);
  const clearRestReminderRef = useRef(clearRestReminder);
  promptRestReminderRef.current = promptRestReminder;
  clearRestReminderRef.current = clearRestReminder;

  const pomodoro = useStorage(pomodoroStateStorage);
  const prevPhaseRef = useRef<PomodoroPhase>(pomodoro.phase);

  useEffect(() => {
    if (!enabled || !enableFocusRestReminder) {
      prevPhaseRef.current = pomodoro.phase;
      return;
    }

    const prev = prevPhaseRef.current;
    prevPhaseRef.current = pomodoro.phase;

    if (prev === 'focus' && pomodoro.phase === 'break') {
      promptRestReminderRef.current([
        createRestReminderAction(() => {
          clearRestReminderRef.current();
        }),
      ]);
      return;
    }

    if (prev === 'break' && (pomodoro.phase === 'idle' || pomodoro.phase === 'focus')) {
      clearRestReminderRef.current();
    }
  }, [enabled, enableFocusRestReminder, pomodoro.phase]);

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
