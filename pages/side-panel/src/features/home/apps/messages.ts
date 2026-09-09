import { PATHS } from '../../../lib/routes';
import { MessageCircle } from 'lucide-react';
import type { DesktopAppDefinition } from '../desktop/types';

const messagesApp: DesktopAppDefinition = {
  id: 'messages',
  label: '短信',
  tone: 'amber',
  order: 30,
  uninstallable: false,
  Icon: MessageCircle,
  openMode: 'page',
  enterEffect: 'circle-expand',
  path: PATHS.messages,
};

export { messagesApp };
