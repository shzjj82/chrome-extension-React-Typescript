import { DOCK_APPS, PAGE_APPS } from './app-catalog';
import { cn } from '@extension/ui';
import { Solar } from 'lunar-javascript';
import { useEffect, useMemo, useState } from 'react';
import type { HomeApp, HomeAppId } from './app-catalog';
import type { MouseEvent } from 'react';

type HomeLauncherProps = {
  isLight: boolean;
  onOpenApp: (id: HomeAppId, event: MouseEvent<HTMLButtonElement>) => void;
};

const formatClock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

const DAY_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 公历日转中文：1→一 … 9→九，10→十，11→十一，20→二十，21→二十一，30→三十，31→三十一 */
const dayToChinese = (day: number) => {
  if (day <= 0 || day > 31) {
    return String(day);
  }
  if (day <= 10) {
    return DAY_CN[day];
  }
  if (day < 20) {
    return `十${DAY_CN[day - 10]}`;
  }
  if (day === 20) {
    return '二十';
  }
  if (day < 30) {
    return `二十${DAY_CN[day - 20]}`;
  }
  if (day === 30) {
    return '三十';
  }
  return '三十一';
};

const AppButton = ({
  app,
  dock = false,
  day,
  weekday,
  onOpenApp,
}: {
  app: HomeApp;
  dock?: boolean;
  day?: number;
  weekday?: string;
  onOpenApp: HomeLauncherProps['onOpenApp'];
}) => {
  const { id, label, tone, Icon } = app;
  const isCalendar = id === 'calendar';

  return (
    <button
      type="button"
      className={cn(
        'phone-app',
        !isCalendar && `phone-app--${tone}`,
        isCalendar && 'phone-app--calendar',
        dock && 'phone-app--dock',
      )}
      aria-label={label}
      onClick={event => onOpenApp(id, event)}>
      <span className="phone-app__icon">
        {isCalendar && day != null && weekday ? (
          <span className="phone-cal-icon">
            <span className="phone-cal-icon__weekday">{weekday}</span>
            <span className="phone-cal-icon__day">{day}</span>
          </span>
        ) : (
          <Icon size={dock ? 24 : 26} strokeWidth={2.1} />
        )}
      </span>
      {dock ? null : <span className="phone-app__label">{label}</span>}
    </button>
  );
};

const HomeLauncher = ({ isLight, onOpenApp }: HomeLauncherProps) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const calendar = useMemo(() => {
    const month = now.toLocaleDateString('zh-CN', { month: 'long' });
    const weekday = now.toLocaleDateString('zh-CN', { weekday: 'short' });
    const day = now.getDate();
    const year = now.getFullYear();
    const lunar = Solar.fromYmd(year, now.getMonth() + 1, day).getLunar();
    const lunarLabel = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    const solarLabel = `${month}${dayToChinese(day)}日 · ${weekday}`;
    return { month, weekday, day, year, lunarLabel, solarLabel };
  }, [now]);

  return (
    <div className={cn('phone-home__content', !isLight && 'phone-home__content--dark')}>
      <section className="phone-home__widgets" aria-label="桌面组件">
        <button
          type="button"
          className="phone-widget phone-widget--moment"
          aria-label={`打开日历，${calendar.year}年 ${calendar.weekday} ${formatClock(now)}，农历${calendar.lunarLabel}`}
          onClick={event => onOpenApp('calendar', event)}>
          <div className="phone-widget__meta">
            <p className="phone-widget__eyebrow">农历{calendar.lunarLabel}</p>
            <p className="phone-widget__year">{calendar.year}年</p>
          </div>
          <p className="phone-widget__clock">{formatClock(now)}</p>
          <p className="phone-widget__sub">{calendar.solarLabel}</p>
        </button>
      </section>

      <main className="phone-home__page" aria-label="应用">
        <div className="phone-home__grid">
          {PAGE_APPS.map(app => (
            <AppButton key={app.id} app={app} day={calendar.day} weekday={calendar.weekday} onOpenApp={onOpenApp} />
          ))}
        </div>
      </main>

      <footer className="phone-home__dock" aria-label="程序坞">
        {DOCK_APPS.map(app => (
          <AppButton
            key={`dock-${app.id}`}
            app={app}
            dock
            day={calendar.day}
            weekday={calendar.weekday}
            onOpenApp={onOpenApp}
          />
        ))}
      </footer>
    </div>
  );
};

export default HomeLauncher;
export type { HomeApp, HomeAppId, HomeAppTone, AppOpenMode, AppEnterEffect } from './app-catalog';
export { HOME_APPS, PAGE_APPS, DOCK_APPS, getHomeApp } from './app-catalog';
export { resolveOpenIntent, PAGE_ROUTE_BY_ID } from './open-intent';
export type { OpenIntent } from './open-intent';
