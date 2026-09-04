import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

/** 专注期间的一次页面浏览 */
type FocusBrowseEntry = {
  url: string;
  title: string;
  visitedAt: number;
};

/** 单次专注会话日志 */
type FocusSessionLog = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  /** 是否达到计入门槛（默认满 40 分钟） */
  counted: boolean;
  browse: FocusBrowseEntry[];
};

type FocusDayLog = {
  dateKey: string;
  sessions: FocusSessionLog[];
};

type FocusLogStateType = {
  days: Record<string, FocusDayLog>;
  /** 当前进行中的专注浏览缓冲 */
  active: {
    startedAt: number;
    browse: FocusBrowseEntry[];
  } | null;
  /** 中途结束后，等待用户确认是否加入整理 */
  pendingOrganizeAsk: {
    durationMs: number;
    browse: FocusBrowseEntry[];
  } | null;
};

type FocusDaySummary = {
  dateKey: string;
  /** 已计入的专注次数 */
  countedCount: number;
  /** 已计入的专注时长（毫秒） */
  countedMs: number;
  /** 当日全部会话数（含未计入） */
  sessionCount: number;
};

type FocusLogStorageType = BaseStorageType<FocusLogStateType> & {
  getDateKey: (at?: number) => string;
  getDaySummary: (dateKey?: string) => Promise<FocusDaySummary>;
  beginActive: (startedAt?: number) => Promise<void>;
  recordBrowse: (entry: FocusBrowseEntry) => Promise<void>;
  finalizeActive: (options: {
    endedAt?: number;
    minCountedMs: number;
    /** 未满门槛时是否弹出「加入整理」询问（中途结束） */
    promptOrganizeIfShort?: boolean;
  }) => Promise<{ session: FocusSessionLog; counted: boolean } | null>;
  clearPendingOrganizeAsk: () => Promise<void>;
};

const defaultFocusLogState: FocusLogStateType = {
  days: {},
  active: null,
  pendingOrganizeAsk: null,
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const getLocalDateKey = (at = Date.now()) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const isSkippableUrl = (url: string) =>
  !url ||
  url.startsWith('chrome://') ||
  url.startsWith('chrome-extension://') ||
  url.startsWith('about:') ||
  url.startsWith('edge://') ||
  url.startsWith('devtools://');

const createSessionId = () => `focus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const summarizeDay = (state: FocusLogStateType, dateKey: string): FocusDaySummary => {
  const day = state.days[dateKey];
  const sessions = day?.sessions ?? [];
  const counted = sessions.filter(s => s.counted);
  return {
    dateKey,
    countedCount: counted.length,
    countedMs: counted.reduce((sum, s) => sum + s.durationMs, 0),
    sessionCount: sessions.length,
  };
};

const storage = createStorage<FocusLogStateType>('focus-log', defaultFocusLogState, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const focusLogStorage: FocusLogStorageType = {
  ...storage,
  getDateKey: getLocalDateKey,
  getDaySummary: async (dateKey = getLocalDateKey()) => summarizeDay(await storage.get(), dateKey),
  beginActive: async (startedAt = Date.now()) => {
    await storage.set(prev => ({
      ...prev,
      active: { startedAt, browse: [] },
      pendingOrganizeAsk: null,
    }));
  },
  recordBrowse: async entry => {
    if (isSkippableUrl(entry.url)) {
      return;
    }
    await storage.set(prev => {
      if (!prev.active) {
        return prev;
      }
      const last = prev.active.browse[prev.active.browse.length - 1];
      // 同一 URL 连续访问只更新标题/时间，避免刷屏
      if (last && last.url === entry.url) {
        return {
          ...prev,
          active: {
            ...prev.active,
            browse: [
              ...prev.active.browse.slice(0, -1),
              { ...last, title: entry.title || last.title, visitedAt: entry.visitedAt },
            ],
          },
        };
      }
      return {
        ...prev,
        active: {
          ...prev.active,
          browse: [...prev.active.browse, entry],
        },
      };
    });
  },
  finalizeActive: async ({ endedAt = Date.now(), minCountedMs, promptOrganizeIfShort = false }) => {
    const prev = await storage.get();
    if (!prev.active) {
      return null;
    }

    const startedAt = prev.active.startedAt;
    const durationMs = Math.max(0, endedAt - startedAt);
    const counted = durationMs >= minCountedMs;
    const session: FocusSessionLog = {
      id: createSessionId(),
      startedAt,
      endedAt,
      durationMs,
      counted,
      browse: prev.active.browse,
    };
    const dateKey = getLocalDateKey(startedAt);
    const day = prev.days[dateKey] ?? { dateKey, sessions: [] };

    await storage.set(current => ({
      ...current,
      active: null,
      pendingOrganizeAsk:
        promptOrganizeIfShort && !counted
          ? {
              durationMs,
              browse: session.browse,
            }
          : null,
      days: {
        ...current.days,
        [dateKey]: {
          dateKey,
          sessions: [...day.sessions, session],
        },
      },
    }));

    return { session, counted };
  },
  clearPendingOrganizeAsk: async () => {
    await storage.set(prev => ({ ...prev, pendingOrganizeAsk: null }));
  },
};

export type { FocusBrowseEntry, FocusDayLog, FocusDaySummary, FocusLogStateType, FocusLogStorageType, FocusSessionLog };
export { defaultFocusLogState, focusLogStorage, getLocalDateKey, isSkippableUrl, summarizeDay };
