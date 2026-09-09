import { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from './apps';
import {
  bootstrapDesktopDefaults,
  desktopRegistry,
  getHomeApp,
  onDesktopLifecycle,
  registerApp,
  registerDock,
  registerWidget,
  resolveOpenIntent,
  unregisterApp,
  unregisterWidget,
  useDesktopLifecycle,
  useDesktopRegistry,
} from './desktop';
import { cn } from '@extension/ui';
import { Solar } from 'lunar-javascript';
import { memo, useEffect, useMemo, useState } from 'react';
import type { DesktopAppDefinition, DesktopAppId, DesktopLifecycleEvent, DesktopRenderContext } from './desktop';
import type { MouseEvent } from 'react';

bootstrapDesktopDefaults();

type HomeLauncherProps = {
  isLight: boolean;
  onOpenApp: (id: DesktopAppId, event?: MouseEvent<HTMLButtonElement>) => void;
  /** 可选：监听桌面生命周期 */
  onDesktopEvent?: (event: DesktopLifecycleEvent) => void;
};

const DAY_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 公历日转中文：1→一 … 31→三十一 */
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

type AppButtonProps = {
  app: DesktopAppDefinition;
  dock?: boolean;
  day: number;
  weekday: string;
  onOpenApp: HomeLauncherProps['onOpenApp'];
};

const AppButton = memo(function AppButton({ app, dock = false, day, weekday, onOpenApp }: AppButtonProps) {
  const { id, label, tone, Icon, renderIcon, surface = 'tone' } = app;
  const size = dock ? 24 : 26;
  const iconNode = renderIcon ? (
    renderIcon({ day, weekday, size, dock })
  ) : Icon ? (
    <Icon size={size} strokeWidth={2.1} />
  ) : null;

  return (
    <button
      type="button"
      className={cn(
        'phone-app',
        surface === 'live-date' ? 'phone-app--calendar' : `phone-app--${tone}`,
        dock && 'phone-app--dock',
      )}
      aria-label={label}
      onClick={event => onOpenApp(id, event)}>
      <span className="phone-app__icon">{iconNode}</span>
      {dock ? null : <span className="phone-app__label">{label}</span>}
    </button>
  );
});

const HomeLauncher = ({ isLight, onOpenApp, onDesktopEvent }: HomeLauncherProps) => {
  const desktop = useDesktopRegistry();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useDesktopLifecycle(onDesktopEvent);

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

  const ctx: DesktopRenderContext = useMemo(
    () => ({
      now,
      day: calendar.day,
      weekday: calendar.weekday,
      year: calendar.year,
      lunarLabel: calendar.lunarLabel,
      solarLabel: calendar.solarLabel,
      openApp: onOpenApp,
    }),
    [now, calendar, onOpenApp],
  );

  const widgetNodes = useMemo(
    () =>
      desktop.widgets.map(widget => (
        <div key={widget.id} className="phone-home__widget-slot" data-widget-id={widget.id}>
          {widget.render(ctx)}
        </div>
      )),
    [desktop.widgets, ctx],
  );

  return (
    <div className={cn('phone-home__content', !isLight && 'phone-home__content--dark')}>
      <section className="phone-home__widgets" aria-label="桌面组件">
        {widgetNodes}
      </section>

      <main className="phone-home__page" aria-label="应用">
        <div className="phone-home__grid">
          {desktop.apps.map(app => (
            <AppButton key={app.id} app={app} day={calendar.day} weekday={calendar.weekday} onOpenApp={onOpenApp} />
          ))}
        </div>
      </main>

      <footer className="phone-home__dock" aria-label="程序坞">
        {desktop.dockApps.map(app => (
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

/** @deprecated 静态快照；运行时请用 useDesktopRegistry / desktopRegistry */
const HOME_APPS = DEFAULT_APPS;
const PAGE_APPS = DEFAULT_APPS;
const DOCK_APPS = DEFAULT_DOCK_APP_IDS.map(id => DEFAULT_APPS.find(app => app.id === id)!);

export default HomeLauncher;

export type {
  DesktopAppDefinition,
  DesktopAppId,
  HomeAppTone,
  AppOpenMode,
  AppEnterEffect,
  HomeAppId,
  HomeApp,
  OpenIntent,
  DesktopLifecycleEvent,
  DesktopSnapshot,
  DesktopWidgetDefinition,
  DesktopDockDefinition,
} from './desktop';

export {
  desktopRegistry,
  registerApp,
  unregisterApp,
  registerWidget,
  unregisterWidget,
  registerDock,
  getHomeApp,
  resolveOpenIntent,
  onDesktopLifecycle,
  useDesktopRegistry,
  useDesktopLifecycle,
  bootstrapDesktopDefaults,
};

export { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from './apps';

export { HOME_APPS, PAGE_APPS, DOCK_APPS };

/** @deprecated 路由已写入 App.path */
export { PAGE_ROUTE_BY_ID } from './open-intent';
