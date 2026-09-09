import { Globe } from 'lucide-react';
import type { DesktopAppDefinition } from '../desktop/types';

const browserApp: DesktopAppDefinition = {
  id: 'browser',
  label: '浏览器',
  tone: 'sky',
  order: 60,
  uninstallable: false,
  Icon: Globe,
  openMode: 'browser',
  enterEffect: 'browser-pop',
  url: 'https://study.mind/browser',
};

export { browserApp };
