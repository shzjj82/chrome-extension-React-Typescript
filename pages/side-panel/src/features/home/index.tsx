import { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from './apps';
import {
  bootstrapDesktopDefaults,
  desktopRegistry,
  getHomeApp,
  hydrateDesktopLayout,
  onDesktopLifecycle,
  persistDesktopLayout,
  registerApp,
  registerDock,
  registerWidget,
  reorderDockApps,
  reorderHomeApps,
  resolveOpenIntent,
  unregisterApp,
  unregisterWidget,
  useDesktopLifecycle,
  useDesktopRegistry,
} from './desktop';
import { useHomeEdit } from './home-edit-context';
import { cn } from '@extension/ui';
import { Solar } from 'lunar-javascript';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DesktopAppDefinition, DesktopAppId, DesktopLifecycleEvent, DesktopRenderContext } from './desktop';
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';

bootstrapDesktopDefaults();

type HomeLauncherProps = {
  isLight: boolean;
  onOpenApp: (id: DesktopAppId, event?: MouseEvent<HTMLButtonElement>) => void;
  /** 可选：监听桌面生命周期 */
  onDesktopEvent?: (event: DesktopLifecycleEvent) => void;
};

type DropZone = 'home' | 'dock';

const DAY_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const LONG_PRESS_MS = 480;

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

const moveId = (ids: string[], fromId: string, toId: string) => {
  if (fromId === toId) {
    return ids;
  }
  const next = ids.filter(id => id !== fromId);
  const toIndex = next.indexOf(toId);
  if (toIndex === -1) {
    next.push(fromId);
    return next;
  }
  next.splice(toIndex, 0, fromId);
  return next;
};

type AppButtonProps = {
  app: DesktopAppDefinition;
  dock?: boolean;
  day: number;
  weekday: string;
  editing: boolean;
  jiggleDelay: number;
  dragging: boolean;
  dropTarget: boolean;
  /** CSS grid/flex order，拖拽预览移位用 */
  layoutOrder: number;
  onOpenApp: HomeLauncherProps['onOpenApp'];
  onRequestEdit: () => void;
  onDelete: (id: DesktopAppId) => void;
  onDragStartApp: (id: DesktopAppId, zone: DropZone) => void;
  onDragEndApp: () => void;
  onDropOnApp: () => void;
  onDragOverApp: (targetId: DesktopAppId | null, zone: DropZone) => void;
  zone: DropZone;
};

const AppButton = memo(function AppButton({
  app,
  dock = false,
  day,
  weekday,
  editing,
  jiggleDelay,
  dragging,
  dropTarget,
  layoutOrder,
  onOpenApp,
  onRequestEdit,
  onDelete,
  onDragStartApp,
  onDragEndApp,
  onDropOnApp,
  onDragOverApp,
  zone,
}: AppButtonProps) {
  const { id, label, tone, Icon, renderIcon, surface = 'tone', uninstallable = true } = app;
  const size = dock ? 24 : 26;
  const canDelete = uninstallable !== false;
  const pressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const origin = useRef({ x: 0, y: 0 });

  const clearPress = () => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const iconNode = renderIcon ? (
    renderIcon({ day, weekday, size, dock })
  ) : Icon ? (
    <Icon size={size} strokeWidth={2.1} />
  ) : null;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || editing) {
      return;
    }
    suppressClick.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      onRequestEdit();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pressTimer.current == null || editing) {
      return;
    }
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    if (dx * dx + dy * dy > 100) {
      clearPress();
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    clearPress();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (editing || suppressClick.current) {
      event.preventDefault();
      suppressClick.current = false;
      return;
    }
    onOpenApp(id, event as unknown as MouseEvent<HTMLButtonElement>);
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onRequestEdit();
  };

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!editing) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    onDragStartApp(id, zone);
  };

  const onDragEnd = () => {
    onDragEndApp();
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!editing) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onDragOverApp(id, zone);
  };

  const onDragLeave = () => {
    onDragOverApp(null, zone);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!editing) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDropOnApp();
    onDragOverApp(null, zone);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'phone-app',
        surface === 'live-date' ? 'phone-app--calendar' : `phone-app--${tone}`,
        dock && 'phone-app--dock',
        editing && 'phone-app--editing',
        editing && !dragging && 'shake-little shake-constant',
        dragging && 'phone-app--dragging',
        dropTarget && 'phone-app--drop-target',
      )}
      style={
        {
          order: layoutOrder,
          ...(editing && !dragging ? { animationDelay: `${jiggleDelay}ms` } : null),
        } as CSSProperties
      }
      aria-label={label}
      draggable={editing}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!editing) {
            onOpenApp(id);
          }
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}>
      {editing && canDelete ? (
        <button
          type="button"
          className="phone-app__delete"
          aria-label={`删除${label}`}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(id);
          }}
          onPointerDown={event => event.stopPropagation()}
        />
      ) : null}
      <span className="phone-app__icon">
        <span className="phone-app__glyph">{iconNode}</span>
      </span>
      {dock ? null : <span className="phone-app__label">{label}</span>}
    </div>
  );
});

const HomeLauncher = ({ isLight, onOpenApp, onDesktopEvent }: HomeLauncherProps) => {
  const desktop = useDesktopRegistry();
  const { editing, setEditing } = useHomeEdit();
  const [now, setNow] = useState(() => new Date());
  const [draggingId, setDraggingId] = useState<DesktopAppId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<DesktopAppId | null>(null);
  /** 拖拽中的预览顺序（用 CSS order 移位，不改 DOM 节点顺序，避免打断拖拽） */
  const [previewHomeOrder, setPreviewHomeOrder] = useState<DesktopAppId[] | null>(null);
  const [previewDockOrder, setPreviewDockOrder] = useState<DesktopAppId[] | null>(null);
  const dragRef = useRef<{ id: DesktopAppId; zone: DropZone } | null>(null);
  const lastShiftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void hydrateDesktopLayout();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!editing) {
      setDraggingId(null);
      setDropTargetId(null);
      setPreviewHomeOrder(null);
      setPreviewDockOrder(null);
      lastShiftKeyRef.current = null;
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditing(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, setEditing]);

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

  const homeIds = useMemo(() => desktop.apps.map(app => app.id), [desktop.apps]);
  const dockIds = useMemo(() => desktop.dockApps.map(app => app.id), [desktop.dockApps]);

  const visualHomeOrder = previewHomeOrder ?? homeIds;
  const visualDockOrder = previewDockOrder ?? dockIds;

  /** DOM 顺序固定（按 id），视觉顺序靠 CSS order */
  const stableHomeApps = useMemo(() => [...desktop.apps].sort((a, b) => a.id.localeCompare(b.id)), [desktop.apps]);
  const stableDockApps = useMemo(
    () => [...desktop.dockApps].sort((a, b) => a.id.localeCompare(b.id)),
    [desktop.dockApps],
  );

  const homeOrderIndex = useMemo(() => new Map(visualHomeOrder.map((id, index) => [id, index])), [visualHomeOrder]);
  const dockOrderIndex = useMemo(() => new Map(visualDockOrder.map((id, index) => [id, index])), [visualDockOrder]);

  const persist = useCallback(async (extra?: { removedIds?: string[] }) => {
    await persistDesktopLayout(extra);
  }, []);

  const onDelete = useCallback(
    (id: DesktopAppId) => {
      const ok = unregisterApp(id);
      if (ok) {
        void persist({ removedIds: [id] });
      }
    },
    [persist],
  );

  const onDragStartApp = useCallback(
    (id: DesktopAppId, zone: DropZone) => {
      dragRef.current = { id, zone };
      lastShiftKeyRef.current = null;
      setDraggingId(id);
      setPreviewHomeOrder([...homeIds]);
      setPreviewDockOrder([...dockIds]);
    },
    [homeIds, dockIds],
  );

  const commitPreview = useCallback(() => {
    if (previewHomeOrder) {
      reorderHomeApps(previewHomeOrder);
    }
    if (previewDockOrder) {
      reorderDockApps(previewDockOrder);
    }
    void persist();
    setPreviewHomeOrder(null);
    setPreviewDockOrder(null);
    lastShiftKeyRef.current = null;
  }, [previewHomeOrder, previewDockOrder, persist]);

  const onDragEndApp = useCallback(() => {
    if (dragRef.current) {
      commitPreview();
    }
    dragRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  }, [commitPreview]);

  const onDragOverApp = useCallback(
    (targetId: DesktopAppId | null, targetZone: DropZone) => {
      setDropTargetId(targetId);
      const drag = dragRef.current;
      if (!drag || !targetId || drag.id === targetId) {
        return;
      }

      const shiftKey = `${drag.zone}:${drag.id}->${targetZone}:${targetId}`;
      if (lastShiftKeyRef.current === shiftKey) {
        return;
      }
      lastShiftKeyRef.current = shiftKey;

      if (drag.zone === 'home' && targetZone === 'home') {
        setPreviewHomeOrder(prev => moveId(prev ?? homeIds, drag.id, targetId));
        return;
      }

      if (drag.zone === 'dock' && targetZone === 'dock') {
        setPreviewDockOrder(prev => moveId(prev ?? dockIds, drag.id, targetId));
        return;
      }

      if (drag.zone === 'home' && targetZone === 'dock') {
        setPreviewDockOrder(prev => {
          const base = prev ?? dockIds;
          const withItem = base.includes(drag.id) ? base : [...base, drag.id];
          return moveId(withItem, drag.id, targetId);
        });
        dragRef.current = { id: drag.id, zone: 'dock' };
        return;
      }

      if (drag.zone === 'dock' && targetZone === 'home') {
        setPreviewDockOrder(prev => (prev ?? dockIds).filter(id => id !== drag.id));
        setPreviewHomeOrder(prev => moveId(prev ?? homeIds, drag.id, targetId));
        dragRef.current = { id: drag.id, zone: 'home' };
      }
    },
    [homeIds, dockIds],
  );

  const onDropOnApp = useCallback(() => {
    commitPreview();
    dragRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  }, [commitPreview]);

  const onDockDragOver = (event: DragEvent<HTMLElement>) => {
    if (!editing) {
      return;
    }
    event.preventDefault();
  };

  const onDockDrop = (event: DragEvent<HTMLElement>) => {
    if (!editing) {
      return;
    }
    event.preventDefault();
    const drag = dragRef.current;
    const nextHome = previewHomeOrder ?? homeIds;
    let nextDock = previewDockOrder ?? dockIds;
    if (drag?.zone === 'home' && !nextDock.includes(drag.id)) {
      nextDock = [...nextDock, drag.id];
    }
    reorderHomeApps(nextHome);
    reorderDockApps(nextDock);
    void persist();
    setPreviewHomeOrder(null);
    setPreviewDockOrder(null);
    lastShiftKeyRef.current = null;
    dragRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const sharedAppProps = {
    day: calendar.day,
    weekday: calendar.weekday,
    editing,
    onOpenApp,
    onRequestEdit: () => setEditing(true),
    onDelete,
    onDragStartApp,
    onDragEndApp,
    onDropOnApp,
    onDragOverApp,
  };

  return (
    <div
      className={cn(
        'phone-home__content',
        !isLight && 'phone-home__content--dark',
        editing && 'phone-home__content--editing',
        draggingId && 'phone-home__content--dragging',
      )}>
      <section className="phone-home__widgets" aria-label="桌面组件">
        {widgetNodes}
      </section>

      <main className="phone-home__page" aria-label="应用">
        <div className="phone-home__grid">
          {stableHomeApps.map(app => (
            <AppButton
              key={app.id}
              app={app}
              jiggleDelay={(homeOrderIndex.get(app.id) ?? 0) * 40}
              zone="home"
              layoutOrder={homeOrderIndex.get(app.id) ?? 0}
              dragging={draggingId === app.id}
              dropTarget={dropTargetId === app.id && draggingId !== app.id}
              {...sharedAppProps}
            />
          ))}
        </div>
      </main>

      <footer
        className={cn('phone-home__dock', editing && 'phone-home__dock--editing')}
        aria-label="程序坞"
        onDragOver={onDockDragOver}
        onDrop={onDockDrop}>
        {stableDockApps.map(app => (
          <AppButton
            key={`dock-${app.id}`}
            app={app}
            dock
            jiggleDelay={(dockOrderIndex.get(app.id) ?? 0) * 40 + 20}
            zone="dock"
            layoutOrder={dockOrderIndex.get(app.id) ?? 0}
            dragging={draggingId === app.id}
            dropTarget={dropTargetId === app.id && draggingId !== app.id}
            {...sharedAppProps}
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
  reorderHomeApps,
  reorderDockApps,
  getHomeApp,
  resolveOpenIntent,
  onDesktopLifecycle,
  useDesktopRegistry,
  useDesktopLifecycle,
  bootstrapDesktopDefaults,
  hydrateDesktopLayout,
  persistDesktopLayout,
};

export { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from './apps';

export { HOME_APPS, PAGE_APPS, DOCK_APPS };

/** @deprecated 路由已写入 App.path */
export { PAGE_ROUTE_BY_ID } from './open-intent';
