import { PATHS } from '../../../lib/routes';
import { BookOpen } from 'lucide-react';
import type { DesktopAppDefinition } from '../desktop/types';

const studyApp: DesktopAppDefinition = {
  id: 'study',
  label: '学习',
  tone: 'ink',
  order: 40,
  uninstallable: false,
  Icon: BookOpen,
  openMode: 'page',
  enterEffect: 'circle-expand',
  path: PATHS.study,
};

export { studyApp };
