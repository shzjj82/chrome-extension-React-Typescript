import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type PomodoroPhase = 'idle' | 'focus' | 'break';

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
};

type PomodoroSettingsStorageType = BaseStorageType<PomodoroSettingsType>;
type PomodoroStateStorageType = BaseStorageType<PomodoroStateType>;

const settingsStorage = createStorage<PomodoroSettingsType>(
  'pomodoro-settings',
  {
    focusMinutes: 25,
    breakMinutes: 5,
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
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const pomodoroSettingsStorage: PomodoroSettingsStorageType = settingsStorage;
const pomodoroStateStorage: PomodoroStateStorageType = stateStorage;

export type {
  PomodoroPhase,
  PomodoroSettingsType,
  PomodoroStateType,
  PomodoroSettingsStorageType,
  PomodoroStateStorageType,
};
export { pomodoroSettingsStorage, pomodoroStateStorage };
