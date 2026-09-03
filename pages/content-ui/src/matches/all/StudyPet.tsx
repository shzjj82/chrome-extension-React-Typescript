import {
  FloatingPet,
  FocusClock,
  createFocusHoverActions,
  createResumeFocusHoverActions,
  createStudyMindPetHoverActions,
  defaultBounds,
  VIEW_SIZE,
} from './pet';
import { useStudyFocusCompanion } from './pet/focus/useStudyFocusCompanion';
import { useStorage } from '@extension/shared';
import { normalizeUserProfile, pomodoroStateStorage, userProfileStorage } from '@extension/storage';
import { useCallback } from 'react';
import type { FloatingPetProps, PetBounds, StageAccessoryContext } from './pet';

type StudyPetProps = Omit<
  FloatingPetProps,
  'resolveBubbleActions' | 'resolveStageAccessory' | 'ariaLabel' | 'onRuntimeReady'
>;

const StudyPet = (props: StudyPetProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const pomodoro = useStorage(pomodoroStateStorage);
  const { clock, onRuntimeReady } = useStudyFocusCompanion(props.enabled !== false);

  const resolveBubbleActions = useCallback(() => {
    if (pomodoro.phase === 'focus') {
      const elapsedMinutes = pomodoro.startedAt ? Math.floor((Date.now() - pomodoro.startedAt) / 60_000) : 0;
      return createFocusHoverActions(elapsedMinutes);
    }
    // 暂停/休息中：恢复专注；默认 idle：仅「专注」
    if (pomodoro.phase === 'break') {
      return createResumeFocusHoverActions();
    }
    return createStudyMindPetHoverActions(profile);
  }, [profile, pomodoro.phase, pomodoro.startedAt]);

  const resolveStageAccessory = useCallback(
    ({ facingLeft, menuVisible }: StageAccessoryContext) => {
      // 气泡与闹钟互斥：hover / 提醒气泡出现时不显示钟
      if (!clock || menuVisible) {
        return null;
      }
      return <FocusClock facingLeft={facingLeft} progress={clock.progress} percentLabel={clock.percentLabel} />;
    },
    [clock],
  );

  return (
    <FloatingPet
      {...props}
      resolveBubbleActions={resolveBubbleActions}
      resolveStageAccessory={resolveStageAccessory}
      onRuntimeReady={onRuntimeReady}
      ariaLabel="Study Mind 陪伴伙伴"
    />
  );
};

export type { PetBounds as Bounds, StudyPetProps };
export { StudyPet, VIEW_SIZE, defaultBounds };
