import { PATHS } from '../../../lib/routes';
import { FolderOpen } from 'lucide-react';
import type { DesktopAppDefinition } from '../desktop/types';

const filesApp: DesktopAppDefinition = {
  id: 'files',
  label: '文件',
  tone: 'rose',
  order: 10,
  uninstallable: false,
  Icon: FolderOpen,
  openMode: 'page',
  enterEffect: 'circle-expand',
  path: PATHS.filesTab('focus'),
  keepAlive: true,
};

export { filesApp };
