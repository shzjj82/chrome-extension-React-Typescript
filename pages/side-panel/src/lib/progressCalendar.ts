import { summarizeDay } from '@extension/storage';
import type { FocusLogStateType } from '@extension/storage';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const pad2 = (n: number) => String(n).padStart(2, '0');

const toLocalDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseDateKey = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return new Date(y, m - 1, d);
};

const shiftMonth = (year: number, month: number, delta: number) => {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
};

type DayProgress = {
  dateKey: string;
  /** 0–1，相对当日目标 */
  progress: number;
  countedCount: number;
  countedMs: number;
  sessionCount: number;
};

type MonthProgressStats = {
  year: number;
  month: number;
  /** 已过去（含今日）天数 */
  elapsedDays: number;
  /** 达到 100% 的天数 */
  completedDays: number;
  /** 有任意专注记录的天数 */
  activeDays: number;
  /** 月完成度：完成天数 / 已过天数 */
  completionRate: number;
  countedCount: number;
  countedMs: number;
};

type CalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  isFuture: boolean;
  isToday: boolean;
  progress: number;
  countedCount: number;
} | null;

const buildDayProgress = (focusLog: FocusLogStateType, dateKey: string, goalMinutes: number): DayProgress => {
  const summary = summarizeDay(focusLog, dateKey);
  const goalMs = Math.max(1, goalMinutes) * 60_000;
  const progress = Math.max(0, Math.min(1, summary.countedMs / goalMs));
  return {
    dateKey,
    progress,
    countedCount: summary.countedCount,
    countedMs: summary.countedMs,
    sessionCount: summary.sessionCount,
  };
};

const buildMonthCells = (
  year: number,
  month: number,
  dayMap: Record<string, DayProgress>,
  todayKey = toLocalDateKey(new Date()),
): CalendarCell[] => {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const items: CalendarCell[] = [];

  for (let i = 0; i < startPad; i += 1) {
    items.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toLocalDateKey(new Date(year, month, day));
    const info = dayMap[key];
    items.push({
      key,
      day,
      inMonth: true,
      isFuture: key > todayKey,
      isToday: key === todayKey,
      progress: info?.progress ?? 0,
      countedCount: info?.countedCount ?? 0,
    });
  }

  while (items.length % 7 !== 0) {
    items.push(null);
  }
  return items;
};

const buildMonthStats = (
  year: number,
  month: number,
  dayMap: Record<string, DayProgress>,
  todayKey = toLocalDateKey(new Date()),
): MonthProgressStats => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let elapsedDays = 0;
  let completedDays = 0;
  let activeDays = 0;
  let countedCount = 0;
  let countedMs = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toLocalDateKey(new Date(year, month, day));
    if (key > todayKey) {
      continue;
    }
    elapsedDays += 1;
    const info = dayMap[key];
    if (!info) {
      continue;
    }
    countedCount += info.countedCount;
    countedMs += info.countedMs;
    if (info.progress > 0 || info.sessionCount > 0) {
      activeDays += 1;
    }
    if (info.progress >= 1) {
      completedDays += 1;
    }
  }

  return {
    year,
    month,
    elapsedDays,
    completedDays,
    activeDays,
    completionRate: elapsedDays > 0 ? completedDays / elapsedDays : 0,
    countedCount,
    countedMs,
  };
};

const buildMonthDayMap = (
  focusLog: FocusLogStateType,
  year: number,
  month: number,
  goalMinutes: number,
): Record<string, DayProgress> => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map: Record<string, DayProgress> = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toLocalDateKey(new Date(year, month, day));
    if (focusLog.days[key] || key === toLocalDateKey(new Date())) {
      map[key] = buildDayProgress(focusLog, key, goalMinutes);
    }
  }
  // 也收录本月已有日志的日期（上面循环已覆盖）；补全 focusLog 里本月键
  for (const key of Object.keys(focusLog.days)) {
    if (!key.startsWith(`${year}-${pad2(month + 1)}`)) {
      continue;
    }
    map[key] = buildDayProgress(focusLog, key, goalMinutes);
  }
  return map;
};

const formatDuration = (ms: number) => {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) {
    return `${totalMin} 分钟`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
};

const formatPercent = (ratio: number) => `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;

export type { DayProgress, MonthProgressStats, CalendarCell };
export {
  WEEKDAYS,
  toLocalDateKey,
  parseDateKey,
  shiftMonth,
  buildDayProgress,
  buildMonthCells,
  buildMonthStats,
  buildMonthDayMap,
  formatDuration,
  formatPercent,
};
