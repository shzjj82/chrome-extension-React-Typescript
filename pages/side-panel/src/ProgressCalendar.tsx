import { WEEKDAYS, buildMonthCells, shiftMonth } from './lib/progressCalendar';
import { cn } from '@extension/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { DayProgress } from './lib/progressCalendar';

type ProgressCalendarProps = {
  year: number;
  month: number;
  dayMap: Record<string, DayProgress>;
  selectedDateKey: string;
  onSelect: (dateKey: string) => void;
  onMonthChange: (year: number, month: number) => void;
  className?: string;
};

const ProgressCalendar = ({
  year,
  month,
  dayMap,
  selectedDateKey,
  onSelect,
  onMonthChange,
  className,
}: ProgressCalendarProps) => {
  const cells = useMemo(() => buildMonthCells(year, month, dayMap), [year, month, dayMap]);
  const monthTitle = `${year}年${month + 1}月`;

  return (
    <div className={cn('progress-cal', className)}>
      <div className="progress-cal__nav">
        <button
          type="button"
          className="progress-cal__nav-btn"
          aria-label="上个月"
          onClick={() => {
            const next = shiftMonth(year, month, -1);
            onMonthChange(next.year, next.month);
          }}>
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <p className="progress-cal__month">{monthTitle}</p>
        <button
          type="button"
          className="progress-cal__nav-btn"
          aria-label="下个月"
          onClick={() => {
            const next = shiftMonth(year, month, 1);
            onMonthChange(next.year, next.month);
          }}>
          <ChevronRight size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="progress-cal__weekdays" aria-hidden="true">
        {WEEKDAYS.map(label => (
          <span key={label} className="progress-cal__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="progress-cal__grid" role="grid" aria-label={monthTitle}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <span key={`pad-${index}`} className="progress-cal__cell progress-cal__cell--empty" />;
          }

          const level =
            cell.isFuture || cell.progress <= 0
              ? 0
              : cell.progress >= 1
                ? 4
                : cell.progress >= 0.66
                  ? 3
                  : cell.progress >= 0.33
                    ? 2
                    : 1;

          const markParts = [
            cell.cn.isHolidayOff ? `休假 ${cell.cn.holidayName}` : '',
            cell.cn.isHolidayWork ? `调休上班（${cell.cn.holidayName}）` : '',
            cell.cn.solarTerm ? `节气 ${cell.cn.solarTerm}` : '',
          ].filter(Boolean);

          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              disabled={cell.isFuture}
              aria-label={`${cell.key} 完成度 ${Math.round(cell.progress * 100)}%${markParts.length ? `，${markParts.join('，')}` : ''}`}
              aria-selected={cell.key === selectedDateKey}
              className={cn(
                'progress-cal__cell',
                `progress-cal__cell--lv${level}`,
                cell.isToday && 'progress-cal__cell--today',
                cell.key === selectedDateKey && 'progress-cal__cell--selected',
                cell.isFuture && 'progress-cal__cell--future',
                cell.cn.isHolidayOff && 'progress-cal__cell--holiday',
                cell.cn.isHolidayWork && 'progress-cal__cell--work',
                cell.cn.solarTerm && !cell.cn.isHolidayOff && !cell.cn.isHolidayWork && 'progress-cal__cell--jieqi',
              )}
              onClick={() => onSelect(cell.key)}>
              <span className="progress-cal__day">{cell.day}</span>
              {cell.cn.badge ? (
                <span
                  className={cn(
                    'progress-cal__badge',
                    cell.cn.isHolidayOff && 'progress-cal__badge--holiday',
                    cell.cn.isHolidayWork && 'progress-cal__badge--work',
                    cell.cn.solarTerm &&
                      !cell.cn.isHolidayOff &&
                      !cell.cn.isHolidayWork &&
                      'progress-cal__badge--jieqi',
                  )}>
                  {cell.cn.badge}
                </span>
              ) : !cell.isFuture && cell.progress > 0 ? (
                <span className="progress-cal__dot" aria-hidden="true" />
              ) : (
                <span className="progress-cal__badge progress-cal__badge--spacer" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressCalendar;
