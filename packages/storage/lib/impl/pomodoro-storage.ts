import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type PomodoroPhase = 'idle' | 'focus' | 'break';

/** 进入休息的原因：仅 timer 到点才弹出「专注很久啦」 */
type PomodoroBreakReason = 'completed' | 'manual' | null;

type PomodoroSettingsType = {
  focusMinutes: number;
  breakMinutes: number;
};

type PomodoroStateType = {
  phase: PomodoroPhase;
  endsAt: number | null;
  startedAt: number | null;
  focusCompletedCount: number;
  accumulatedFocusMs: number;
  activeSessionId: string | null;
  /** focus→break 来源；非 completed 不展示「专注很久啦」提醒 */
  breakReason: PomodoroBreakReason;
};

type PomodoroSettingsStorageType = BaseStorageType<PomodoroSettingsType>;
type PomodoroStateStorageType = BaseStorageType<PomodoroStateType>;

const settingsStorage = createStorage<PomodoroSettingsType>(
  'pomodoro-settings',
  {
    focusMinutes: 40,
    breakMinutes: 10,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const stateStorage = createStorage<PomodoroStateType>(
  'pomodoro-state',
  {
    phase: 'idle',
    endsAt: null,
    startedAt: null,
    focusCompletedCount: 0,
    accumulatedFocusMs: 0,
    activeSessionId: null,
    breakReason: null,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const pomodoroSettingsStorage: PomodoroSettingsStorageType = settingsStorage;
const pomodoroStateStorage: PomodoroStateStorageType = stateStorage;

export type {
  PomodoroBreakReason,
  PomodoroPhase,
  PomodoroSettingsType,
  PomodoroStateType,
  PomodoroSettingsStorageType,
  PomodoroStateStorageType,
};
export { pomodoroSettingsStorage, pomodoroStateStorage };
