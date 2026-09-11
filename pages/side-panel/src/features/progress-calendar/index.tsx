import ProgressCalendar from './calendar';
import { getCnDayMarkByKey } from './cn-calendar';
import {
  buildDayProgress,
  buildMonthDayMap,
  formatDuration,
  formatPercent,
  parseDateKey,
  toLocalDateKey,
} from './model';
import { useAppHeader } from '../../layouts';
import { useStorage } from '@extension/shared';
import { focusLogStorage, pomodoroSettingsStorage } from '@extension/storage';
import { cn } from '@extension/ui';
import { useMemo, useState } from 'react';

type ProgressCalendarPanelProps = {
  isLight: boolean;
  onBack?: () => void;
};

const ProgressCalendarPanel = ({ isLight, onBack }: ProgressCalendarPanelProps) => {
  const focusLog = useStorage(focusLogStorage);
  const pomodoroSettings = useStorage(pomodoroSettingsStorage);
  const todayKey = toLocalDateKey();
  const today = parseDateKey(todayKey);

  const [viewYear, setViewYear] = useState(() => today?.year() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today?.month() ?? new Date().getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const goalMinutes = Math.max(1, pomodoroSettings.focusMinutes || 40);

  const dayMap = useMemo(
    () => buildMonthDayMap(focusLog, viewYear, viewMonth, goalMinutes),
    [focusLog, viewYear, viewMonth, goalMinutes],
  );

  const selected = useMemo(() => {
    const fromMap = dayMap[selectedDateKey];
    if (fromMap) {
      return fromMap;
    }
    return buildDayProgress(focusLog, selectedDateKey, goalMinutes);
  }, [dayMap, selectedDateKey, focusLog, goalMinutes]);

  const selectedCn = useMemo(() => getCnDayMarkByKey(selectedDateKey), [selectedDateKey]);

  const selectedLabel = useMemo(() => {
    const date = parseDateKey(selectedDateKey);
    if (!date) {
      return selectedDateKey;
    }
    if (selectedDateKey === todayKey) {
      return '今天';
    }
    return `${date.month() + 1}月${date.date()}日`;
  }, [selectedDateKey, todayKey]);

  useAppHeader('日历', { onBack });

  return (
    <div className={cn('sm-shell progress-cal-panel', !isLight && 'sm-shell--dark')}>
      <div className="progress-cal-panel__scroll">
        <ProgressCalendar
          year={viewYear}
          month={viewMonth}
          dayMap={dayMap}
          selectedDateKey={selectedDateKey}
          onSelect={setSelectedDateKey}
          onMonthChange={(year, month) => {
            setViewYear(year);
            setViewMonth(month);
          }}
        />

        <section className="progress-cal-panel__day" aria-label="当日详情">
          <div className="progress-cal-day__top">
            <h2 className="progress-cal-day__title">{selectedLabel}</h2>
            <span className="progress-cal-day__percent">{formatPercent(selected.progress)}</span>
          </div>
          {selectedCn.holidayName || selectedCn.solarTerm || selectedCn.isWeekendRest ? (
            <p className="progress-cal-day__marks">
              {selectedCn.isHolidayOff ? (
                <span className="progress-cal-day__mark progress-cal-day__mark--holiday">
                  休假 · {selectedCn.holidayName}
                </span>
              ) : null}
              {selectedCn.isHolidayWork ? (
                <span className="progress-cal-day__mark progress-cal-day__mark--work">
                  调休上班 · {selectedCn.holidayName}
                </span>
              ) : null}
              {selectedCn.isWeekendRest && !selectedCn.isHolidayOff ? (
                <span className="progress-cal-day__mark progress-cal-day__mark--holiday">周末休息</span>
              ) : null}
              {selectedCn.solarTerm ? (
                <span className="progress-cal-day__mark progress-cal-day__mark--jieqi">
                  节气 · {selectedCn.solarTerm}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="progress-cal-day__bar" aria-hidden="true">
            <span className="progress-cal-day__bar-fill" style={{ width: formatPercent(selected.progress) }} />
          </div>
          <dl className="progress-cal-day__meta">
            <div>
              <dt>计入次数</dt>
              <dd>{selected.countedCount} 次</dd>
            </div>
            <div>
              <dt>计入时长</dt>
              <dd>{formatDuration(selected.countedMs)}</dd>
            </div>
            <div>
              <dt>全部会话</dt>
              <dd>{selected.sessionCount} 次</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
};

export default ProgressCalendarPanel;
