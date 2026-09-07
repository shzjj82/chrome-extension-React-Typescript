import BackIconButton from './BackIconButton';
import { getCnDayMarkByKey } from './lib/cnCalendar';
import {
  buildDayProgress,
  buildMonthDayMap,
  buildMonthStats,
  formatDuration,
  formatPercent,
  parseDateKey,
  toLocalDateKey,
} from './lib/progressCalendar';
import PhoneStatusBar from './PhoneStatusBar';
import ProgressCalendar from './ProgressCalendar';
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
  const todayKey = toLocalDateKey(new Date());
  const today = parseDateKey(todayKey) ?? new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const goalMinutes = Math.max(1, pomodoroSettings.focusMinutes || 40);

  const dayMap = useMemo(
    () => buildMonthDayMap(focusLog, viewYear, viewMonth, goalMinutes),
    [focusLog, viewYear, viewMonth, goalMinutes],
  );

  const monthStats = useMemo(
    () => buildMonthStats(viewYear, viewMonth, dayMap, todayKey),
    [viewYear, viewMonth, dayMap, todayKey],
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
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }, [selectedDateKey, todayKey]);

  return (
    <div className={cn('side-panel sm-shell progress-cal-panel', !isLight && 'sm-shell--dark')}>
      <PhoneStatusBar
        className="progress-cal-panel__status"
        leading={onBack ? <BackIconButton onClick={onBack} /> : null}
      />

      <div className="progress-cal-panel__header">
        <h1 className="progress-cal-panel__title">专注日历</h1>
        <p className="progress-cal-panel__hint">每日目标 {goalMinutes} 分钟计入完成</p>
      </div>

      <div className="progress-cal-panel__scroll">
        <section className="progress-cal-panel__stats" aria-label="本月完成度">
          <div className="progress-cal-stat progress-cal-stat--hero">
            <p className="progress-cal-stat__label">本月完成度</p>
            <p className="progress-cal-stat__value">{formatPercent(monthStats.completionRate)}</p>
            <p className="progress-cal-stat__sub">
              {monthStats.completedDays}/{monthStats.elapsedDays} 天达标
            </p>
          </div>
          <div className="progress-cal-stat">
            <p className="progress-cal-stat__label">有效专注</p>
            <p className="progress-cal-stat__value progress-cal-stat__value--sm">{monthStats.countedCount}</p>
            <p className="progress-cal-stat__sub">次</p>
          </div>
          <div className="progress-cal-stat">
            <p className="progress-cal-stat__label">累计时长</p>
            <p className="progress-cal-stat__value progress-cal-stat__value--sm">
              {Math.round(monthStats.countedMs / 60_000)}
            </p>
            <p className="progress-cal-stat__sub">分钟</p>
          </div>
        </section>

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
          {selectedCn.holidayName || selectedCn.solarTerm ? (
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
