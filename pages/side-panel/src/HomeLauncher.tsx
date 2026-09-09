import { DOCK_APPS, PAGE_APPS } from './appCatalog';
import PhoneStatusBar from './PhoneStatusBar';
import { cn } from '@extension/ui';
import { useEffect, useMemo, useState } from 'react';
import type { HomeApp, HomeAppId } from './appCatalog';
import type { MouseEvent } from 'react';

type HomeLauncherProps = {
  isLight: boolean;
  onOpenApp: (id: HomeAppId, event: MouseEvent<HTMLButtonElement>) => void;
};

const formatClock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

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
    return { month, weekday, day, year };
  }, [now]);

  return (
    <div className={cn('side-panel phone-home', !isLight && 'phone-home--dark')}>
      <div className="phone-home__wallpaper" aria-hidden="true" />

      <PhoneStatusBar className="phone-home__status-bar" clockLeft />

      <section className="phone-home__widgets" aria-label="桌面组件">
        <article className="phone-widget phone-widget--time">
          <p className="phone-widget__eyebrow">时间</p>
          <p className="phone-widget__clock">{formatClock(now)}</p>
          <p className="phone-widget__sub">{calendar.weekday}</p>
        </article>

        <button
          type="button"
          className="phone-widget phone-widget--cal"
          aria-label="打开日历"
          onClick={event => onOpenApp('calendar', event)}>
          <p className="phone-widget__eyebrow">{calendar.month}</p>
          <p className="phone-widget__day">{calendar.day}</p>
          <p className="phone-widget__sub">
            {calendar.year} · {calendar.weekday}
          </p>
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

      <div className="phone-home__home-bar" aria-hidden="true" />
    </div>
  );
};

export default HomeLauncher;
