import { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from '../apps';
import { applyDesktopLayout, desktopRegistry, registerApp, registerDock, registerWidget } from '../desktop/registry';
import { momentWidget } from '../widgets/moment';
import { desktopLayoutStorage } from '@extension/storage';

let bootstrapped = false;
let layoutHydrated = false;

/** 注册内置应用、程序坞与时间小组件（幂等；批量只刷一次快照） */
const bootstrapDesktopDefaults = () => {
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

  desktopRegistry.runBatch(() => {
    DEFAULT_APPS.forEach(app => {
      registerApp(app);
    });
    registerWidget(momentWidget);
    registerDock({
      id: 'default',
      appIds: [...DEFAULT_DOCK_APP_IDS],
    });
  });
};

/** 启动时强制用最新默认定义刷新已注册应用的元数据（如 uninstallable） */
const refreshDefaultAppMeta = () => {
  desktopRegistry.runBatch(() => {
    DEFAULT_APPS.forEach(app => {
      const existing = desktopRegistry.getApp(app.id);
      if (existing) {
        registerApp({ ...existing, ...app, order: existing.order ?? app.order });
      }
    });
  });
};

/** 读取本地布局并应用到注册表（启动时调用一次） */
const hydrateDesktopLayout = async () => {
  if (layoutHydrated) {
    return;
  }
  layoutHydrated = true;
  bootstrapDesktopDefaults();
  refreshDefaultAppMeta();
  try {
    const layout = await desktopLayoutStorage.get();
    applyDesktopLayout({
      homeOrder: layout.homeOrder,
      dockOrder: layout.dockOrder.length > 0 ? layout.dockOrder : [...DEFAULT_DOCK_APP_IDS],
      removedIds: layout.removedIds,
    });
  } catch {
    // storage 不可用时保持默认
  }
};

/** 把当前注册表布局写回本地 */
const persistDesktopLayout = async (extra?: { removedIds?: string[] }) => {
  const snap = desktopRegistry.getLayoutSnapshot();
  const prev = (await desktopLayoutStorage.get()) ?? { homeOrder: [], dockOrder: [], removedIds: [] };
  const removedIds = Array.from(new Set([...(prev.removedIds ?? []), ...(extra?.removedIds ?? [])]));
  await desktopLayoutStorage.set({
    homeOrder: snap.homeOrder,
    dockOrder: snap.dockOrder,
    removedIds,
  });
};

export { bootstrapDesktopDefaults, hydrateDesktopLayout, persistDesktopLayout };
