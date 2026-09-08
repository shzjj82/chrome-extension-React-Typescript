import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import type { ConfigType, Dayjs } from 'dayjs';

/* dayjs 是 CJS：运行时只有 default.extend，无可用 named export `extend` */
/* eslint-disable import-x/no-named-as-default-member -- dayjs.extend plugins */
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
/* eslint-enable import-x/no-named-as-default-member */

/** 本地日历日键，避免 UTC 解析导致跨日偏差 */
const DATE_KEY_FORMAT = 'YYYY-MM-DD';

const toLocalDateKey = (value: ConfigType = dayjs()) => dayjs(value).format(DATE_KEY_FORMAT);

const parseDateKey = (dateKey: string): Dayjs | null => {
  const parsed = dayjs(dateKey, DATE_KEY_FORMAT, true);
  return parsed.isValid() ? parsed : null;
};

const isFutureDateKey = (dateKey: string, todayKey = toLocalDateKey()) => dateKey > todayKey;

const isTodayDateKey = (dateKey: string, todayKey = toLocalDateKey()) => dateKey === todayKey;

const shiftMonth = (year: number, month: number, delta: number) => {
  const next = dayjs().year(year).month(month).date(1).add(delta, 'month');
  return { year: next.year(), month: next.month() };
};

const daysInMonth = (year: number, month: number) => dayjs().year(year).month(month).date(1).daysInMonth();

const monthStartWeekday = (year: number, month: number) => dayjs().year(year).month(month).date(1).day();

const dateKeyOf = (year: number, month: number, day: number) =>
  dayjs().year(year).month(month).date(day).format(DATE_KEY_FORMAT);

/** 当前月是否还可翻到「下月」（不超过今天所在月） */
const canGoNextMonth = (viewYear: number, viewMonth: number, today = dayjs()) =>
  viewYear < today.year() || (viewYear === today.year() && viewMonth < today.month());

export type { Dayjs };
export {
  dayjs,
  DATE_KEY_FORMAT,
  toLocalDateKey,
  parseDateKey,
  isFutureDateKey,
  isTodayDateKey,
  shiftMonth,
  daysInMonth,
  monthStartWeekday,
  dateKeyOf,
  canGoNextMonth,
};
