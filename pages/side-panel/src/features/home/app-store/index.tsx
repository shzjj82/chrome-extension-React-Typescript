import { DEFAULT_APPS } from '../apps';
import { installDesktopApp, useDesktopRegistry } from '../desktop';
import { cn } from '@extension/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DesktopAppDefinition, DesktopAppId } from '../desktop';

type InstallPhase = 'idle' | 'installing' | 'done';

type InstallButtonProps = {
  phase: InstallPhase;
  progress: number;
  onInstall: () => void;
};

const CIRCLE_R = 11;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

/** iOS 风格：获取 → 圆环进度 → 打开 */
const InstallButton = ({ phase, progress, onInstall }: InstallButtonProps) => {
  if (phase === 'installing') {
    const offset = CIRCLE_C * (1 - Math.min(1, Math.max(0, progress)));
    return (
      <button type="button" className="app-store-install app-store-install--progress" aria-label="正在安装" disabled>
        <svg className="app-store-install__ring" viewBox="0 0 28 28" aria-hidden="true">
          <circle className="app-store-install__track" cx="14" cy="14" r={CIRCLE_R} fill="none" strokeWidth="2.2" />
          <circle
            className="app-store-install__arc"
            cx="14"
            cy="14"
            r={CIRCLE_R}
            fill="none"
            strokeWidth="2.2"
            strokeDasharray={CIRCLE_C}
            strokeDashoffset={offset}
            transform="rotate(-90 14 14)"
          />
        </svg>
        <span className="app-store-install__pause" aria-hidden="true" />
      </button>
    );
  }

  if (phase === 'done') {
    return (
      <span className="app-store-install app-store-install--done" aria-label="已安装">
        打开
      </span>
    );
  }

  return (
    <button type="button" className="app-store-install" onClick={onInstall}>
      获取
    </button>
  );
};

type AppStoreRowProps = {
  app: DesktopAppDefinition;
  day: number;
  weekday: string;
  phase: InstallPhase;
  progress: number;
  onInstall: (id: DesktopAppId) => void;
};

const AppStoreRow = ({ app, day, weekday, phase, progress, onInstall }: AppStoreRowProps) => {
  const { id, label, tone, Icon, renderIcon, surface = 'tone' } = app;
  const iconNode = renderIcon ? (
    renderIcon({ day, weekday, size: 22, dock: false })
  ) : Icon ? (
    <Icon size={22} strokeWidth={2.1} />
  ) : null;

  return (
    <li className={cn('app-store-row', phase === 'done' && 'app-store-row--done')}>
      <span
        className={cn(
          'app-store-row__icon',
          surface === 'live-date' ? 'phone-app--calendar' : `phone-app--${tone}`,
          'app-store-row__icon-shell',
        )}
        aria-hidden="true">
        <span className="phone-app__icon">{iconNode}</span>
      </span>
      <div className="app-store-row__meta">
        <p className="app-store-row__name">{label}</p>
        <p className="app-store-row__desc">桌面应用 · 可重新安装</p>
      </div>
      <InstallButton phase={phase} progress={progress} onInstall={() => onInstall(id)} />
    </li>
  );
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const AppStorePanel = () => {
  const snapshot = useDesktopRegistry();
  const installedIds = useMemo(() => new Set(snapshot.apps.map(app => app.id)), [snapshot.apps]);
  const available = useMemo(
    () => DEFAULT_APPS.filter(app => app.uninstallable !== false && !installedIds.has(app.id)),
    [installedIds],
  );

  const [phases, setPhases] = useState<Record<string, InstallPhase>>({});
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const rafMapRef = useRef<Map<string, number>>(new Map());
  const installingSetRef = useRef<Set<string>>(new Set());

  const rows = useMemo(() => {
    const map = new Map(available.map(app => [app.id, app]));
    Object.entries(phases).forEach(([id, phase]) => {
      if ((phase === 'installing' || phase === 'done') && !map.has(id)) {
        const def = DEFAULT_APPS.find(app => app.id === id);
        if (def) {
          map.set(id, def);
        }
      }
    });
    return Array.from(map.values());
  }, [available, phases]);

  const now = useMemo(() => new Date(), []);
  const day = now.getDate();
  const weekday = WEEKDAYS[now.getDay()] ?? '周一';

  useEffect(
    () => () => {
      rafMapRef.current.forEach(handle => cancelAnimationFrame(handle));
      rafMapRef.current.clear();
    },
    [],
  );

  const runInstallProgress = useCallback((id: DesktopAppId) => {
    if (installingSetRef.current.has(id)) {
      return;
    }
    installingSetRef.current.add(id);
    setPhases(prev => ({ ...prev, [id]: 'installing' }));
    setProgressMap(prev => ({ ...prev, [id]: 0 }));

    const duration = 1400 + Math.random() * 600;
    const started = performance.now();

    const tick = (ts: number) => {
      const t = Math.min(1, (ts - started) / duration);
      const eased = t < 0.55 ? t * 0.55 : 0.3 + (t - 0.55) * (0.7 / 0.45);
      setProgressMap(prev => ({ ...prev, [id]: Math.min(1, eased) }));
      if (t < 1) {
        rafMapRef.current.set(id, requestAnimationFrame(tick));
        return;
      }
      rafMapRef.current.delete(id);
      void (async () => {
        await installDesktopApp(id);
        setPhases(prev => ({ ...prev, [id]: 'done' }));
        setProgressMap(prev => ({ ...prev, [id]: 1 }));
        installingSetRef.current.delete(id);
        window.setTimeout(() => {
          setPhases(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 700);
      })();
    };

    rafMapRef.current.set(id, requestAnimationFrame(tick));
  }, []);

  const onInstall = useCallback(
    (id: DesktopAppId) => {
      runInstallProgress(id);
    },
    [runInstallProgress],
  );

  if (rows.length === 0) {
    return (
      <div className="app-store">
        <div className="app-store__empty">
          <p className="app-store__empty-title">暂无可安装应用</p>
          <p className="app-store__empty-hint">从桌面删除应用后，会在这里出现，可再次获取。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-store">
      <p className="app-store__lead">已删除的应用可在此重新安装到桌面。</p>
      <ul className="app-store__list">
        {rows.map(app => (
          <AppStoreRow
            key={app.id}
            app={app}
            day={day}
            weekday={weekday}
            phase={phases[app.id] ?? 'idle'}
            progress={progressMap[app.id] ?? 0}
            onInstall={onInstall}
          />
        ))}
      </ul>
    </div>
  );
};

export default AppStorePanel;
