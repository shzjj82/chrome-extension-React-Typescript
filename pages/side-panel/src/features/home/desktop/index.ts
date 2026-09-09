export type {
  DesktopAppId,
  HomeAppTone,
  AppOpenMode,
  AppEnterEffect,
  DesktopRenderContext,
  DesktopAppIconProps,
  DesktopAppDefinition,
  DesktopWidgetDefinition,
  DesktopDockDefinition,
  OpenIntent,
  DesktopLifecycleEvent,
  DesktopSnapshot,
  HomeAppId,
  HomeApp,
} from './types';

export {
  desktopRegistry,
  registerApp,
  unregisterApp,
  registerWidget,
  unregisterWidget,
  registerDock,
  reorderHomeApps,
  reorderDockApps,
  applyDesktopLayout,
  getHomeApp,
  resolveOpenIntent,
  onDesktopLifecycle,
} from './registry';

export { useDesktopRegistry } from './use-desktop-registry';
export { useDesktopLifecycle } from './use-desktop-lifecycle';
export { bootstrapDesktopDefaults, hydrateDesktopLayout, persistDesktopLayout } from './bootstrap';
