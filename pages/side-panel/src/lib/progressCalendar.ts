import { getCnDayMark } from './cnCalendar';
import {
  dateKeyOf,
  daysInMonth,
  isFutureDateKey,
  isTodayDateKey,
  monthStartWeekday,
  parseDateKey,
  shiftMonth,
  toLocalDateKey,
} from './dayjs';
import { summarizeDay } from '@extension/storage';
import type { CnDayMark } from './cnCalendar';
import type { FocusLogStateType } from '@extension/storage';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const pad2 = (n: number) => String(n).padStart(2, '0');

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
  cn: CnDayMark;
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
  todayKey = toLocalDateKey(),
): CalendarCell[] => {
  const startPad = monthStartWeekday(year, month);
  const totalDays = daysInMonth(year, month);
  const items: CalendarCell[] = [];

  for (let i = 0; i < startPad; i += 1) {
    items.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const key = dateKeyOf(year, month, day);
    const info = dayMap[key];
    items.push({
      key,
      day,
      inMonth: true,
      isFuture: isFutureDateKey(key, todayKey),
      isToday: isTodayDateKey(key, todayKey),
      progress: info?.progress ?? 0,
      countedCount: info?.countedCount ?? 0,
      cn: getCnDayMark(year, month, day),
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
  todayKey = toLocalDateKey(),
): MonthProgressStats => {
  const totalDays = daysInMonth(year, month);
  let elapsedDays = 0;
  let completedDays = 0;
  let activeDays = 0;
  let countedCount = 0;
  let countedMs = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const key = dateKeyOf(year, month, day);
    if (isFutureDateKey(key, todayKey)) {
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
  const totalDays = daysInMonth(year, month);
  const todayKey = toLocalDateKey();
  const map: Record<string, DayProgress> = {};
  for (let day = 1; day <= totalDays; day += 1) {
    const key = dateKeyOf(year, month, day);
    if (focusLog.days[key] || key === todayKey) {
      map[key] = buildDayProgress(focusLog, key, goalMinutes);
    }
  }
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
