import { createFocusProgressAction, createRestReminderAction } from '../interactions/studyMindActions';
import { useStorage } from '@extension/shared';
import { pomodoroStateStorage } from '@extension/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PetEventHookContext, PetEventPayloadMap } from '../events';
import type { PetRuntimeApi } from '../types';
import type { PomodoroPhase } from '@extension/storage';

const FOCUS_PROGRESS_INTERVAL_MS = 5 * 60_000;
const TICK_MS = 1000;

type FocusClockModel = {
  progress: number;
  percentLabel: string;
};

type UseStudyFocusCompanionResult = {
  focusing: boolean;
  clock: FocusClockModel | null;
  onRuntimeReady: (api: PetRuntimeApi | null) => void;
};

const calcFocusProgress = (startedAt: number | null, endsAt: number | null, now: number) => {
  if (!startedAt || !endsAt || endsAt <= startedAt) {
    return { progress: 0, percent: 0, elapsedMinutes: 0 };
  }
  const total = endsAt - startedAt;
  const elapsed = Math.min(total, Math.max(0, now - startedAt));
  const progress = elapsed / total;
  const percent = Math.round(progress * 100);
  const elapsedMinutes = Math.floor(elapsed / 60_000);
  return { progress, percent, elapsedMinutes };
};

/**
 * Study Mind 专注陪伴：通过统一事件钩子挂载业务。
 * - fire('focus-sit') / endEvent('focus-sit')
 * - fire('look-clock', { progress })
 * - fire('rest-prompt') + bubble
 */
const useStudyFocusCompanion = (enabled = true): UseStudyFocusCompanionResult => {
  const pomodoro = useStorage(pomodoroStateStorage);
  const runtimeRef = useRef<PetRuntimeApi | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const prevPhaseRef = useRef<PomodoroPhase | null>(null);
  const lastProgressMarkRef = useRef(0);
  const focusingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [clock, setClock] = useState<FocusClockModel | null>(null);

  const focusing = enabled && pomodoro.phase === 'focus';
  focusingRef.current = focusing;
  const clockActiveRef = useRef(false);

  const onRuntimeReady = useCallback((api: PetRuntimeApi | null) => {
    unsubRef.current?.();
    unsubRef.current = null;
    runtimeRef.current = api;
    if (!api) {
      setClock(null);
      clockActiveRef.current = false;
      return;
    }

    // 默认事件钩子：看钟 → 更新附件状态（统一回调参数）
    unsubRef.current = api.onEvent('look-clock', (ctx: PetEventHookContext) => {
      if (ctx.lifecycle === 'end') {
        setClock(null);
        return;
      }
      const payload = ctx.payload as PetEventPayloadMap['look-clock'] | undefined;
      if (!payload) {
        return;
      }
      setClock({
        progress: payload.progress,
        percentLabel: payload.percentLabel ?? `${Math.round(payload.progress * 100)}%`,
      });
    });

    if (focusingRef.current) {
      api.fire('focus-sit');
    } else {
      api.endEvent('focus-sit');
      api.endEvent('look-clock');
      clockActiveRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!focusing) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [focusing, pomodoro.startedAt, pomodoro.endsAt]);

  useEffect(() => {
    const api = runtimeRef.current;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = pomodoro.phase;

    if (!enabled) {
      api?.endEvent('focus-sit');
      api?.endEvent('look-clock');
      clockActiveRef.current = false;
      return;
    }

    if (pomodoro.phase === 'focus') {
      api?.fire('focus-sit');
      if (prev !== 'focus') {
        const startedAt = pomodoro.startedAt ?? Date.now();
        lastProgressMarkRef.current = Math.floor((Date.now() - startedAt) / FOCUS_PROGRESS_INTERVAL_MS);
        clockActiveRef.current = false;
      }
    } else {
      api?.endEvent('focus-sit');
      api?.endEvent('look-clock');
      clockActiveRef.current = false;
    }

    if (prev === null) {
      return;
    }

    if (prev === 'focus' && pomodoro.phase === 'break') {
      // 仅专注时长自然结束后提醒「专注很久啦」；暂停休息不弹
      if (pomodoro.breakReason === 'completed') {
        api?.promptRestReminder([
          createRestReminderAction(() => {
            runtimeRef.current?.clearRestReminder();
          }),
        ]);
      }
      return;
    }

    if (prev === 'break' && (pomodoro.phase === 'idle' || pomodoro.phase === 'focus')) {
      api?.clearRestReminder();
    }

    if (prev === 'focus' && pomodoro.phase === 'idle') {
      api?.clearRestReminder();
    }
  }, [enabled, pomodoro.phase, pomodoro.startedAt, pomodoro.breakReason]);

  useEffect(() => {
    if (!focusing || !pomodoro.startedAt || !pomodoro.endsAt) {
      return;
    }

    const { progress, percent, elapsedMinutes } = calcFocusProgress(pomodoro.startedAt, pomodoro.endsAt, now);
    const payload = {
      progress,
      percentLabel: `${percent}%`,
    } satisfies PetEventPayloadMap['look-clock'];

    const api = runtimeRef.current;
    if (api) {
      if (clockActiveRef.current) {
        api.updateEvent('look-clock', payload);
      } else {
        api.fire('look-clock', payload);
        clockActiveRef.current = true;
      }
    }

    const mark = Math.floor((now - pomodoro.startedAt) / FOCUS_PROGRESS_INTERVAL_MS);
    if (mark > 0 && mark > lastProgressMarkRef.current && progress < 1) {
      lastProgressMarkRef.current = mark;
      runtimeRef.current?.showTemporaryBubble([createFocusProgressAction(elapsedMinutes, percent)]);
    }
  }, [focusing, now, pomodoro.startedAt, pomodoro.endsAt]);

  return { focusing, clock, onRuntimeReady };
};

export { useStudyFocusCompanion };
export type { FocusClockModel, UseStudyFocusCompanionResult };
