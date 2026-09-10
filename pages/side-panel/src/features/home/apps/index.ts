import { calendarApp } from './calendar';
import { PATHS } from '../../../lib/routes';
import { BookOpen, FolderOpen, Globe, LayoutGrid, MessageCircle, Phone, Settings2, Store } from 'lucide-react';
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
  uninstallable: true,
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
  uninstallable: true,
  Icon: BookOpen,
  openMode: 'page',
  enterEffect: 'circle-expand',
  path: PATHS.studyTab('organize'),
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
  uninstallable: true,
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
  uninstallable: true,
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
  uninstallable: true,
  Icon: Store,
  openMode: 'sheet',
  enterEffect: 'sheet-up',
  sheetId: 'store',
};

/** 应用商店：与「商店」不同；系统级入口，不可删除 */
const appStoreApp: DesktopAppDefinition = {
  id: 'app-store',
  label: '应用商店',
  tone: 'sky',
  order: 90,
  uninstallable: false,
  Icon: LayoutGrid,
  openMode: 'sheet',
  enterEffect: 'sheet-up',
  sheetId: 'app-store',
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
  appStoreApp,
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
  appStoreApp,
  DEFAULT_APPS,
  DEFAULT_DOCK_APP_IDS,
};
