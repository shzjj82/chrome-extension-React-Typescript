import { DEFAULT_APPS, DEFAULT_DOCK_APP_IDS } from '../apps';
import { desktopRegistry, registerApp, registerDock, registerWidget } from '../desktop/registry';
import { momentWidget } from '../widgets/moment';

let bootstrapped = false;

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

export { bootstrapDesktopDefaults };
