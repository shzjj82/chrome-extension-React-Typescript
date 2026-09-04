import { cn } from '@extension/ui';
import { BookOpen, FolderOpen, MessageCircle, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

type HomeAppId = 'files' | 'messages' | 'study' | 'settings';

type HomeApp = {
  id: HomeAppId;
  label: string;
  tone: 'rose' | 'amber' | 'ink' | 'sage';
  Icon: LucideIcon;
};

const APPS: HomeApp[] = [
  { id: 'files', label: '文件', tone: 'rose', Icon: FolderOpen },
  { id: 'messages', label: '短信', tone: 'amber', Icon: MessageCircle },
  { id: 'study', label: '学习', tone: 'ink', Icon: BookOpen },
  { id: 'settings', label: '设置', tone: 'sage', Icon: Settings2 },
];

type HomeLauncherProps = {
  isLight: boolean;
  onOpenApp: (id: HomeAppId, event: MouseEvent<HTMLButtonElement>) => void;
};

const formatClock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

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

      <header className="phone-home__status" aria-hidden="true">
        <span className="phone-home__carrier">Study Mind</span>
        <span className="phone-home__status-dots">
          <i />
          <i />
          <i />
        </span>
      </header>

      <section className="phone-home__widgets" aria-label="桌面组件">
        <article className="phone-widget phone-widget--time">
          <p className="phone-widget__eyebrow">时间</p>
          <p className="phone-widget__clock">{formatClock(now)}</p>
          <p className="phone-widget__sub">{calendar.weekday}</p>
        </article>

        <article className="phone-widget phone-widget--cal">
          <p className="phone-widget__eyebrow">{calendar.month}</p>
          <p className="phone-widget__day">{calendar.day}</p>
          <p className="phone-widget__sub">
            {calendar.year} · {calendar.weekday}
          </p>
        </article>
      </section>

      <main className="phone-home__page" aria-label="应用">
        <div className="phone-home__grid">
          {APPS.map(({ id, label, tone, Icon }) => (
            <button
              key={id}
              type="button"
              className={cn('phone-app', `phone-app--${tone}`)}
              onClick={event => onOpenApp(id, event)}>
              <span className="phone-app__icon">
                <Icon size={26} strokeWidth={2.1} />
              </span>
              <span className="phone-app__label">{label}</span>
            </button>
          ))}
        </div>
      </main>

      <footer className="phone-home__dock" aria-label="程序坞">
        {APPS.map(({ id, label, tone, Icon }) => (
          <button
            key={`dock-${id}`}
            type="button"
            className={cn('phone-app phone-app--dock', `phone-app--${tone}`)}
            aria-label={label}
            onClick={event => onOpenApp(id, event)}>
            <span className="phone-app__icon">
              <Icon size={24} strokeWidth={2.1} />
            </span>
          </button>
        ))}
      </footer>

      <div className="phone-home__home-bar" aria-hidden="true" />
    </div>
  );
};

export type { HomeAppId };
export default HomeLauncher;
