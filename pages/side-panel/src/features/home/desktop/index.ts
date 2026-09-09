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
  getHomeApp,
  resolveOpenIntent,
  onDesktopLifecycle,
} from './registry';

export { useDesktopRegistry } from './use-desktop-registry';
export { useDesktopLifecycle } from './use-desktop-lifecycle';
export { bootstrapDesktopDefaults } from './bootstrap';
