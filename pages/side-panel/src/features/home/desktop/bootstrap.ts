import { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from '../apps';
import { applyDesktopLayout, desktopRegistry, registerApp, registerDock, registerWidget } from '../desktop/registry';
import { momentWidget } from '../widgets/moment';
import { desktopLayoutStorage } from '@extension/storage';

let bootstrapped = false;

const readRemovedIds = async (): Promise<string[]> => {
  try {
    const layout = await desktopLayoutStorage.get();
    return layout.removedIds ?? [];
  } catch {
    return [];
  }
};

/** 按本地 deleted 名单卸载（可重复调用） */
const applyRemovedAppsFromStorage = async () => {
  const removedIds = await readRemovedIds();
  if (removedIds.length === 0) {
    return;
  }
  applyDesktopLayout({ removedIds });
};

/** 注册内置应用、程序坞与时间小组件（幂等） */
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

  void applyRemovedAppsFromStorage();
};

/** 刷新元数据；已删除的不会被补注册回来 */
const refreshDefaultAppMeta = async () => {
  const removed = new Set(await readRemovedIds());
  desktopRegistry.runBatch(() => {
    DEFAULT_APPS.forEach(app => {
      if (removed.has(app.id)) {
        return;
      }
      const existing = desktopRegistry.getApp(app.id);
      if (existing) {
        registerApp({ ...existing, ...app, order: existing.order ?? app.order });
      } else {
        registerApp(app);
      }
    });
  });
};

/** 读取本地布局并应用到注册表（可重复调用） */
const hydrateDesktopLayout = async () => {
  bootstrapDesktopDefaults();
  await refreshDefaultAppMeta();
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
const persistDesktopLayout = async (extra?: { removedIds?: string[]; clearRemovedIds?: string[] }) => {
  const snap = desktopRegistry.getLayoutSnapshot();
  const prev = (await desktopLayoutStorage.get()) ?? { homeOrder: [], dockOrder: [], removedIds: [] };
  let removedIds = Array.from(new Set([...(prev.removedIds ?? []), ...(extra?.removedIds ?? [])]));
  if (extra?.clearRemovedIds?.length) {
    const clear = new Set(extra.clearRemovedIds);
    removedIds = removedIds.filter(id => !clear.has(id));
  }
  await desktopLayoutStorage.set({
    homeOrder: snap.homeOrder,
    dockOrder: snap.dockOrder,
    removedIds,
  });
};

/** 卸载桌面应用并写入 deleted 名单 */
const uninstallDesktopApp = async (id: string): Promise<boolean> => {
  const existing = desktopRegistry.getApp(id);
  if (!existing) {
    await persistDesktopLayout({ removedIds: [id] });
    return true;
  }
  if (existing.uninstallable === false) {
    return false;
  }
  const ok = desktopRegistry.unregisterApp(id);
  await persistDesktopLayout({ removedIds: [id] });
  return ok;
};

/** 从内置目录安装（重装）应用到桌面 */
const installDesktopApp = async (id: string): Promise<boolean> => {
  const def = DEFAULT_APPS.find(app => app.id === id);
  if (!def || def.uninstallable === false) {
    return false;
  }
  if (desktopRegistry.getApp(id)) {
    await persistDesktopLayout({ clearRemovedIds: [id] });
    return true;
  }
  const homeCount = desktopRegistry.getLayoutSnapshot().homeOrder.length;
  registerApp({ ...def, order: (homeCount + 1) * 10 });
  await persistDesktopLayout({ clearRemovedIds: [id] });
  return true;
};

export {
  bootstrapDesktopDefaults,
  hydrateDesktopLayout,
  persistDesktopLayout,
  installDesktopApp,
  uninstallDesktopApp,
  applyRemovedAppsFromStorage,
};
