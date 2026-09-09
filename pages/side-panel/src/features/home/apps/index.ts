import { calendarApp } from './calendar';
import { PATHS } from '../../../lib/routes';
import { BookOpen, FolderOpen, Globe, MessageCircle, Phone, Settings2, Store } from 'lucide-react';
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

const studyApp: DesktopAppDefinition = {
  id: 'study',
  label: '学习',
  tone: 'ink',
  order: 40,
  Icon: BookOpen,
  openMode: 'page',
  enterEffect: 'circle-expand',
  path: PATHS.study,
};

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

const browserApp: DesktopAppDefinition = {
  id: 'browser',
  label: '浏览器',
  tone: 'sky',
  order: 60,
  Icon: Globe,
  openMode: 'browser',
  enterEffect: 'browser-pop',
  url: 'https://study.mind/browser',
};

const phoneApp: DesktopAppDefinition = {
  id: 'phone',
  label: '电话',
  tone: 'violet',
  order: 70,
  Icon: Phone,
  openMode: 'sheet',
  enterEffect: 'sheet-up',
  sheetId: 'phone',
};

const storeApp: DesktopAppDefinition = {
  id: 'store',
  label: '商店',
  tone: 'coral',
  order: 80,
  Icon: Store,
  openMode: 'sheet',
  enterEffect: 'sheet-up',
  sheetId: 'store',
};

/** 内置应用定义（注册前可被外部覆盖） */
const DEFAULT_APPS: DesktopAppDefinition[] = [
  filesApp,
  calendarApp,
  messagesApp,
  studyApp,
  settingsApp,
  browserApp,
  phoneApp,
  storeApp,
];

const DEFAULT_DOCK_APP_IDS = ['files', 'calendar', 'browser', 'phone'] as const;

export {
  filesApp,
  calendarApp,
  messagesApp,
  studyApp,
  settingsApp,
  browserApp,
  phoneApp,
  storeApp,
  DEFAULT_APPS,
  DEFAULT_DOCK_APP_IDS,
};
