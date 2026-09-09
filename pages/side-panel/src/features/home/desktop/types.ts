import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

/** 应用 id 为可扩展字符串；内置 id 仍可作字面量使用 */
type DesktopAppId = string;

type HomeAppTone = 'rose' | 'amber' | 'ink' | 'sage' | 'sky' | 'violet' | 'coral';

/** 打开形态 */
type AppOpenMode = 'page' | 'browser' | 'sheet' | 'external';

/** 入场效果 */
type AppEnterEffect = 'circle-expand' | 'browser-pop' | 'sheet-up' | 'none';

/** 桌面渲染上下文（图标 / widget 共用） */
type DesktopRenderContext = {
  now: Date;
  day: number;
  weekday: string;
  year: number;
  lunarLabel: string;
  solarLabel: string;
  openApp: (id: DesktopAppId, event?: MouseEvent<HTMLButtonElement>) => void;
};

type DesktopAppIconProps = {
  day: number;
  weekday: string;
  size: number;
  dock: boolean;
};

type DesktopAppDefinition = {
  id: DesktopAppId;
  label: string;
  tone: HomeAppTone;
  /** 主屏排序，越小越靠前 */
  order?: number;
  /** 默认 true；false 时 unregister 会被拒绝 */
  uninstallable?: boolean;
  /**
   * 图标表面：
   * - tone：渐变底 + Lucide
   * - live-date：白底日历活字（不靠 id 特判）
   */
  surface?: 'tone' | 'live-date';
  /** 自定义图标；缺省用 Icon */
  renderIcon?: (props: DesktopAppIconProps) => ReactNode;
  Icon?: LucideIcon;
  openMode: AppOpenMode;
  enterEffect: AppEnterEffect;
  /** page：路由 path */
  path?: string;
  /** page：是否 keepalive（如文件中心） */
  keepAlive?: boolean;
  /** browser：地址栏 */
  url?: string;
  /** sheet：浮层内容 id（可与 app id 相同） */
  sheetId?: string;
};

type DesktopWidgetDefinition = {
  id: string;
  /** 越小越靠前 */
  order?: number;
  uninstallable?: boolean;
  render: (ctx: DesktopRenderContext) => ReactNode;
};

type DesktopDockDefinition = {
  /** 程序坞配置 id，例如 default */
  id: string;
  /** 槽位上的应用 id 列表（按显示顺序） */
  appIds: DesktopAppId[];
};

type OpenIntent =
  | { kind: 'external' }
  | { kind: 'browser'; title: string; url: string; appId: DesktopAppId }
  | { kind: 'sheet'; title: string; appId: DesktopAppId }
  | { kind: 'reveal'; tone: HomeAppTone; path: string; keepFilesAlive?: boolean };

type DesktopLifecycleEvent =
  | { type: 'app:registered'; app: DesktopAppDefinition }
  | { type: 'app:unregistered'; id: DesktopAppId }
  | { type: 'widget:registered'; widget: DesktopWidgetDefinition }
  | { type: 'widget:unregistered'; id: string }
  | { type: 'dock:updated'; dock: DesktopDockDefinition }
  | { type: 'layout:updated'; homeOrder: DesktopAppId[]; dockOrder: DesktopAppId[] }
  | { type: 'app:before-open'; id: DesktopAppId }
  | { type: 'app:opened'; id: DesktopAppId; intent: OpenIntent }
  | { type: 'app:open-failed'; id: DesktopAppId; reason: string };

type DesktopSnapshot = {
  version: number;
  apps: DesktopAppDefinition[];
  widgets: DesktopWidgetDefinition[];
  dock: DesktopDockDefinition | null;
  dockApps: DesktopAppDefinition[];
};

/** @deprecated 兼容旧命名；新代码请用 DesktopAppId */
type HomeAppId =
  | 'files'
  | 'calendar'
  | 'messages'
  | 'study'
  | 'settings'
  | 'browser'
  | 'phone'
  | 'store'
  | 'app-store'
  | (string & {});

type HomeApp = DesktopAppDefinition;

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
};
