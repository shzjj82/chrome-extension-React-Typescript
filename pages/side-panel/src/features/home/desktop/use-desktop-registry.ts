import { desktopRegistry } from './registry';
import { useSyncExternalStore } from 'react';
import type { DesktopSnapshot } from './types';

const useDesktopRegistry = (): DesktopSnapshot =>
  useSyncExternalStore(desktopRegistry.subscribe, desktopRegistry.getSnapshot, desktopRegistry.getSnapshot);

export { useDesktopRegistry };
