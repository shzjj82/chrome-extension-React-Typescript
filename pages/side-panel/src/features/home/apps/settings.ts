import { Settings2 } from 'lucide-react';
import type { DesktopAppDefinition } from '../desktop/types';

const settingsApp: DesktopAppDefinition = {
  id: 'settings',
  label: '设置',
  tone: 'sage',
  order: 50,
  uninstallable: false,
  Icon: Settings2,
  openMode: 'external',
  enterEffect: 'none',
};

export { settingsApp };
