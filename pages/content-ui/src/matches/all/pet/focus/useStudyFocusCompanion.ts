import { createFocusProgressAction, createRestReminderAction } from '../interactions/studyMindActions';
import { useStorage } from '@extension/shared';
import { pomodoroStateStorage } from '@extension/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Study Mind 专注陪伴：坐锁 / 休息提醒 / 进度气泡 / 闹钟数据。
 * 全部在宠物组件外部驱动，PetController 只提供 lockSit 等通用能力。
 */
const useStudyFocusCompanion = (enabled = true): UseStudyFocusCompanionResult => {
  const pomodoro = useStorage(pomodoroStateStorage);
  const runtimeRef = useRef<PetRuntimeApi | null>(null);
  const prevPhaseRef = useRef<PomodoroPhase | null>(null);
  const lastProgressMarkRef = useRef(0);
  const focusingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const focusing = enabled && pomodoro.phase === 'focus';
  focusingRef.current = focusing;

  const onRuntimeReady = useCallback((api: PetRuntimeApi | null) => {
    runtimeRef.current = api;
    if (!api) {
      return;
    }
    if (focusingRef.current) {
      api.lockSit();
    } else {
      api.unlockSit();
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
      api?.unlockSit();
      return;
    }

    if (pomodoro.phase === 'focus') {
      api?.lockSit();
      if (prev !== 'focus') {
        const startedAt = pomodoro.startedAt ?? Date.now();
        lastProgressMarkRef.current = Math.floor((Date.now() - startedAt) / FOCUS_PROGRESS_INTERVAL_MS);
      }
    } else {
      api?.unlockSit();
    }

    if (prev === null) {
      return;
    }

    if (prev === 'focus' && pomodoro.phase === 'break') {
      api?.promptRestReminder([
        createRestReminderAction(() => {
          runtimeRef.current?.clearRestReminder();
        }),
      ]);
      return;
    }

    if (prev === 'break' && (pomodoro.phase === 'idle' || pomodoro.phase === 'focus')) {
      api?.clearRestReminder();
    }

    if (prev === 'focus' && pomodoro.phase === 'idle') {
      api?.clearRestReminder();
    }
  }, [enabled, pomodoro.phase, pomodoro.startedAt]);

  useEffect(() => {
    if (!focusing || !pomodoro.startedAt || !pomodoro.endsAt) {
      return;
    }

    const { progress, percent, elapsedMinutes } = calcFocusProgress(pomodoro.startedAt, pomodoro.endsAt, now);
    const mark = Math.floor((now - pomodoro.startedAt) / FOCUS_PROGRESS_INTERVAL_MS);

    if (mark > 0 && mark > lastProgressMarkRef.current && progress < 1) {
      lastProgressMarkRef.current = mark;
      runtimeRef.current?.showTemporaryBubble([createFocusProgressAction(elapsedMinutes, percent)]);
    }
  }, [focusing, now, pomodoro.startedAt, pomodoro.endsAt]);

  const focusStats = calcFocusProgress(pomodoro.startedAt, pomodoro.endsAt, now);
  const clock: FocusClockModel | null = focusing
    ? { progress: focusStats.progress, percentLabel: `${focusStats.percent}%` }
    : null;

  return { focusing, clock, onRuntimeReady };
};

export { useStudyFocusCompanion };
export type { FocusClockModel, UseStudyFocusCompanionResult };
