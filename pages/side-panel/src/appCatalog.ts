import { BookOpen, FolderOpen, Globe, MessageCircle, Phone, Settings2, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type HomeAppId = 'files' | 'messages' | 'study' | 'settings' | 'browser' | 'phone' | 'store';

type HomeAppTone = 'rose' | 'amber' | 'ink' | 'sage' | 'sky' | 'violet' | 'coral';

/** 打开形态 */
type AppOpenMode = 'page' | 'browser' | 'sheet' | 'external';

/** 入场效果 */
type AppEnterEffect = 'circle-expand' | 'browser-pop' | 'sheet-up' | 'none';

type HomeApp = {
  id: HomeAppId;
  label: string;
  tone: HomeAppTone;
  Icon: LucideIcon;
  openMode: AppOpenMode;
  enterEffect: AppEnterEffect;
  /** 浏览器地址栏展示 */
  url?: string;
};

const HOME_APPS: HomeApp[] = [
  {
    id: 'files',
    label: '文件',
    tone: 'rose',
    Icon: FolderOpen,
    openMode: 'page',
    enterEffect: 'circle-expand',
  },
  {
    id: 'messages',
    label: '短信',
    tone: 'amber',
    Icon: MessageCircle,
    openMode: 'page',
    enterEffect: 'circle-expand',
  },
  {
    id: 'study',
    label: '学习',
    tone: 'ink',
    Icon: BookOpen,
    openMode: 'page',
    enterEffect: 'circle-expand',
  },
  {
    id: 'settings',
    label: '设置',
    tone: 'sage',
    Icon: Settings2,
    openMode: 'external',
    enterEffect: 'none',
  },
  {
    id: 'browser',
    label: '浏览器',
    tone: 'sky',
    Icon: Globe,
    openMode: 'browser',
    enterEffect: 'browser-pop',
    url: 'https://study.mind/browser',
  },
  {
    id: 'phone',
    label: '电话',
    tone: 'violet',
    Icon: Phone,
    openMode: 'sheet',
    enterEffect: 'sheet-up',
  },
  {
    id: 'store',
    label: '商店',
    tone: 'coral',
    Icon: Store,
    openMode: 'sheet',
    enterEffect: 'sheet-up',
  },
];

const DOCK_APP_IDS: HomeAppId[] = ['files', 'messages', 'browser', 'phone'];

const getHomeApp = (id: HomeAppId) => HOME_APPS.find(app => app.id === id);

const PAGE_APPS = HOME_APPS;
const DOCK_APPS = DOCK_APP_IDS.map(id => getHomeApp(id)!);

export type { HomeAppId, HomeAppTone, AppOpenMode, AppEnterEffect, HomeApp };
export { HOME_APPS, PAGE_APPS, DOCK_APPS, getHomeApp };
