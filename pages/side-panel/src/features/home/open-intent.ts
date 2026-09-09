import { PATHS } from '../../lib/routes';
import type { HomeApp, HomeAppId, HomeAppTone } from './app-catalog';

/** 桌面点击应用后的打开意图（与 React 状态解耦，便于单测与扩展） */
type OpenIntent =
  | { kind: 'external' }
  | { kind: 'browser'; title: string; url: string }
  | { kind: 'sheet'; appId: 'phone' | 'store'; title: string }
  | { kind: 'reveal'; tone: HomeAppTone; path: string; keepFilesAlive?: boolean };

const PAGE_ROUTE_BY_ID: Partial<Record<HomeAppId, string>> = {
  files: PATHS.filesTab('focus'),
  calendar: PATHS.calendar,
  messages: PATHS.messages,
  study: PATHS.study,
};

const resolveOpenIntent = (app: HomeApp): OpenIntent | null => {
  switch (app.openMode) {
    case 'external':
      return { kind: 'external' };
    case 'browser':
      return { kind: 'browser', title: app.label, url: app.url ?? '' };
    case 'sheet':
      if (app.id !== 'phone' && app.id !== 'store') {
        return null;
      }
      return { kind: 'sheet', appId: app.id, title: app.label };
    case 'page': {
      const path = PAGE_ROUTE_BY_ID[app.id];
      if (!path) {
        return null;
      }
      return {
        kind: 'reveal',
        tone: app.tone,
        path,
        keepFilesAlive: app.id === 'files',
      };
    }
    default:
      return null;
  }
};

export type { OpenIntent };
export { resolveOpenIntent, PAGE_ROUTE_BY_ID };
