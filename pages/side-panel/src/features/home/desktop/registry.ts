import type {
  DesktopAppDefinition,
  DesktopAppId,
  DesktopDockDefinition,
  DesktopLifecycleEvent,
  DesktopSnapshot,
  DesktopWidgetDefinition,
  OpenIntent,
} from './types';

type Unsubscribe = () => void;

const sortByOrder = <T extends { id: string; order?: number }>(items: T[]) =>
  [...items].sort((a, b) => {
    const orderA = a.order ?? 100;
    const orderB = b.order ?? 100;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.id.localeCompare(b.id);
  });

class DesktopRegistry {
  private apps = new Map<DesktopAppId, DesktopAppDefinition>();
  private widgets = new Map<string, DesktopWidgetDefinition>();
  private dock: DesktopDockDefinition | null = null;
  private version = 0;
  private batchDepth = 0;
  private batchDirty = false;
  private snapshot: DesktopSnapshot = {
    version: 0,
    apps: [],
    widgets: [],
    dock: null,
    dockApps: [],
  };
  private readonly changeListeners = new Set<() => void>();
  private readonly lifecycleListeners = new Set<(event: DesktopLifecycleEvent) => void>();

  private rebuildSnapshot = () => {
    this.version += 1;
    const apps = sortByOrder([...this.apps.values()]);
    const widgets = sortByOrder([...this.widgets.values()]);
    const dockApps =
      this.dock?.appIds.map(id => this.apps.get(id)).filter((app): app is DesktopAppDefinition => Boolean(app)) ?? [];
    this.snapshot = {
      version: this.version,
      apps,
      widgets,
      dock: this.dock,
      dockApps,
    };
  };

  private flushChange = () => {
    this.rebuildSnapshot();
    this.changeListeners.forEach(listener => listener());
  };

  private notify = (event: DesktopLifecycleEvent) => {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      // 批量注册期间只保留结构变更，不刷生命周期，避免启动连环重渲
      return;
    }
    this.flushChange();
    this.lifecycleListeners.forEach(listener => listener(event));
  };

  /** 批量写入注册表，只触发一次快照更新 */
  runBatch = (fn: () => void) => {
    this.batchDepth += 1;
    try {
      fn();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        this.flushChange();
      }
    }
  };

  /** 仅广播生命周期，不改注册表（如 open） */
  emit = (event: DesktopLifecycleEvent) => {
    this.lifecycleListeners.forEach(listener => listener(event));
  };

  subscribe = (listener: () => void): Unsubscribe => {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  };

  onLifecycle = (listener: (event: DesktopLifecycleEvent) => void): Unsubscribe => {
    this.lifecycleListeners.add(listener);
    return () => {
      this.lifecycleListeners.delete(listener);
    };
  };

  getSnapshot = (): DesktopSnapshot => this.snapshot;

  getApp = (id: DesktopAppId) => this.apps.get(id);

  listApps = () => this.snapshot.apps;

  listWidgets = () => this.snapshot.widgets;

  getDockApps = () => this.snapshot.dockApps;

  registerApp = (app: DesktopAppDefinition): Unsubscribe => {
    const next: DesktopAppDefinition = {
      uninstallable: true,
      order: 100,
      ...app,
    };
    this.apps.set(next.id, next);
    this.notify({ type: 'app:registered', app: next });
    return () => {
      this.unregisterApp(next.id);
    };
  };

  unregisterApp = (id: DesktopAppId): boolean => {
    const existing = this.apps.get(id);
    if (!existing) {
      return false;
    }
    if (existing.uninstallable === false) {
      return false;
    }
    this.apps.delete(id);
    if (this.dock) {
      const filtered = this.dock.appIds.filter(appId => appId !== id);
      if (filtered.length !== this.dock.appIds.length) {
        this.dock = { ...this.dock, appIds: filtered };
      }
    }
    this.notify({ type: 'app:unregistered', id });
    return true;
  };

  registerWidget = (widget: DesktopWidgetDefinition): Unsubscribe => {
    const next: DesktopWidgetDefinition = {
      uninstallable: true,
      order: 100,
      ...widget,
    };
    this.widgets.set(next.id, next);
    this.notify({ type: 'widget:registered', widget: next });
    return () => {
      this.unregisterWidget(next.id);
    };
  };

  unregisterWidget = (id: string): boolean => {
    const existing = this.widgets.get(id);
    if (!existing) {
      return false;
    }
    if (existing.uninstallable === false) {
      return false;
    }
    this.widgets.delete(id);
    this.notify({ type: 'widget:unregistered', id });
    return true;
  };

  /** 注册 / 替换整个程序坞槽位列表 */
  registerDock = (dock: DesktopDockDefinition): Unsubscribe => {
    this.dock = { ...dock, appIds: [...dock.appIds] };
    this.notify({ type: 'dock:updated', dock: this.dock });
    return () => {
      if (this.dock?.id === dock.id) {
        this.dock = null;
        this.notify({ type: 'dock:updated', dock: { id: dock.id, appIds: [] } });
      }
    };
  };

  setDockAppIds = (appIds: DesktopAppId[], dockId = 'default') => {
    this.registerDock({ id: dockId, appIds });
  };

  resolveOpenIntent = (app: DesktopAppDefinition): OpenIntent | null => {
    switch (app.openMode) {
      case 'external':
        return { kind: 'external' };
      case 'browser':
        return { kind: 'browser', title: app.label, url: app.url ?? '', appId: app.id };
      case 'sheet':
        return { kind: 'sheet', title: app.label, appId: app.sheetId ?? app.id };
      case 'page': {
        if (!app.path) {
          return null;
        }
        return {
          kind: 'reveal',
          tone: app.tone,
          path: app.path,
          keepFilesAlive: Boolean(app.keepAlive),
        };
      }
      default:
        return null;
    }
  };

  /** 打开前发生命周期事件，并解析意图 */
  openApp = (id: DesktopAppId): OpenIntent | null => {
    this.emit({ type: 'app:before-open', id });
    const app = this.apps.get(id);
    if (!app) {
      this.emit({ type: 'app:open-failed', id, reason: 'not-registered' });
      return null;
    }
    const intent = this.resolveOpenIntent(app);
    if (!intent) {
      this.emit({ type: 'app:open-failed', id, reason: 'no-intent' });
      return null;
    }
    this.emit({ type: 'app:opened', id, intent });
    return intent;
  };
}

const desktopRegistry = new DesktopRegistry();

const registerApp = (app: DesktopAppDefinition) => desktopRegistry.registerApp(app);
const unregisterApp = (id: DesktopAppId) => desktopRegistry.unregisterApp(id);
const registerWidget = (widget: DesktopWidgetDefinition) => desktopRegistry.registerWidget(widget);
const unregisterWidget = (id: string) => desktopRegistry.unregisterWidget(id);
const registerDock = (dock: DesktopDockDefinition) => desktopRegistry.registerDock(dock);
const getHomeApp = (id: DesktopAppId) => desktopRegistry.getApp(id);
const resolveOpenIntent = (app: DesktopAppDefinition) => desktopRegistry.resolveOpenIntent(app);
const onDesktopLifecycle = (listener: (event: DesktopLifecycleEvent) => void) => desktopRegistry.onLifecycle(listener);
const runDesktopBatch = (fn: () => void) => desktopRegistry.runBatch(fn);

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
  runDesktopBatch,
};
export type { Unsubscribe };
