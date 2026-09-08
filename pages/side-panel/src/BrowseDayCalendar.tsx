import {
  canGoNextMonth,
  dateKeyOf,
  daysInMonth,
  isFutureDateKey,
  monthStartWeekday,
  parseDateKey,
  shiftMonth,
  toLocalDateKey,
  dayjs,
} from './lib/dayjs';
import { cn } from '@extension/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

type BrowseDayCalendarProps = {
  selectedDateKey: string;
  recordDateKeys: Set<string>;
  dayLabel: string;
  total: number;
  /** 隐藏日期触发器与面板，保留刷新等操作 */
  hideCalendar?: boolean;
  onSelect: (dateKey: string) => void;
  onRefresh?: () => void;
};

const BrowseDayCalendar = ({
  selectedDateKey,
  recordDateKeys,
  dayLabel,
  total,
  hideCalendar = false,
  onSelect,
  onRefresh,
}: BrowseDayCalendarProps) => {
  const selected = parseDateKey(selectedDateKey) ?? dayjs();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => selected.year());
  const [viewMonth, setViewMonth] = useState(() => selected.month());
  const rootRef = useRef<HTMLDivElement>(null);
  const todayKey = toLocalDateKey();

  useEffect(() => {
    if (hideCalendar) {
      setOpen(false);
    }
  }, [hideCalendar]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const date = parseDateKey(selectedDateKey) ?? dayjs();
    setViewYear(date.year());
    setViewMonth(date.month());
  }, [open, selectedDateKey]);

  const cells = useMemo(() => {
    const startPad = monthStartWeekday(viewYear, viewMonth);
    const totalDays = daysInMonth(viewYear, viewMonth);
    const items: Array<{
      key: string;
      day: number;
      hasRecords: boolean;
      isFuture: boolean;
    } | null> = [];

    for (let i = 0; i < startPad; i += 1) {
      items.push(null);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const key = dateKeyOf(viewYear, viewMonth, day);
      items.push({
        key,
        day,
        hasRecords: recordDateKeys.has(key),
        isFuture: isFutureDateKey(key, todayKey),
      });
    }
    while (items.length % 7 !== 0) {
      items.push(null);
    }
    return items;
  }, [viewYear, viewMonth, recordDateKeys, todayKey]);

  const monthTitle = `${viewYear}年${viewMonth + 1}月`;
  const allowNextMonth = canGoNextMonth(viewYear, viewMonth);

  return (
    <div className={cn('browse-cal', open && 'browse-cal--open')} ref={rootRef}>
      <div className="browse-cal__bar">
        <button
          type="button"
          className={cn('browse-cal__trigger', open && 'browse-cal__trigger--open')}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-hidden={hideCalendar}
          tabIndex={hideCalendar ? -1 : undefined}
          onClick={() => {
            if (hideCalendar) {
              return;
            }
            setOpen(value => !value);
          }}>
          <span className="browse-cal__trigger-label">
            {dayLabel}
            <span className="sm-shell__muted"> · {total} 条</span>
          </span>
          <span className="browse-cal__trigger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M3 10h18M8 3v4M16 3v4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
        {onRefresh ? (
          <button type="button" className="browse-cal__nav browse-cal__refresh" aria-label="刷新" onClick={onRefresh}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M20 12a8 8 0 1 1-2.2-5.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <path
                d="M20 4v5h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <button type="button" className="browse-cal__backdrop" aria-label="关闭日历" onClick={() => setOpen(false)} />
          <div className="browse-cal__panel" role="dialog" aria-modal="true" aria-label="选择日期">
            <div className="browse-cal__month-row">
              <button
                type="button"
                className="browse-cal__month-nav"
                aria-label="上个月"
                onClick={() => {
                  const next = shiftMonth(viewYear, viewMonth, -1);
                  setViewYear(next.year);
                  setViewMonth(next.month);
                }}>
                上月
              </button>
              <p className="browse-cal__month">{monthTitle}</p>
              <button
                type="button"
                className="browse-cal__month-nav"
                aria-label="下个月"
                disabled={!allowNextMonth}
                onClick={() => {
                  if (!allowNextMonth) {
                    return;
                  }
                  const next = shiftMonth(viewYear, viewMonth, 1);
                  setViewYear(next.year);
                  setViewMonth(next.month);
                }}>
                下月
              </button>
            </div>

            <div className="browse-cal__weekdays">
              {WEEKDAYS.map(label => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="browse-cal__grid">
              {cells.map((cell, index) =>
                cell ? (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={cell.isFuture}
                    aria-disabled={cell.isFuture}
                    className={cn(
                      'browse-cal__day',
                      cell.key === selectedDateKey && !cell.isFuture && 'browse-cal__day--selected',
                      cell.key === todayKey && 'browse-cal__day--today',
                      cell.hasRecords && !cell.isFuture && 'browse-cal__day--has',
                      cell.isFuture && 'browse-cal__day--future',
                    )}
                    onClick={() => {
                      if (cell.isFuture) {
                        return;
                      }
                      onSelect(cell.key);
                      setOpen(false);
                    }}>
                    {cell.day}
                    {cell.hasRecords && !cell.isFuture ? <i className="browse-cal__dot" aria-hidden="true" /> : null}
                  </button>
                ) : (
                  <span key={`pad-${index}`} className="browse-cal__day browse-cal__day--empty" />
                ),
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export { toLocalDateKey };
export default BrowseDayCalendar;
