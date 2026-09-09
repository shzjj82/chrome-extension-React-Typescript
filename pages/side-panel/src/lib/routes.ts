/** 侧栏 MemoryRouter 路径约定 */

type FilesHubTab = 'ask' | 'focus' | 'favorites';

const PATHS = {
  home: '/',
  files: '/files',
  filesTab: (tab: FilesHubTab) => `/files/${tab}`,
  messages: '/messages',
  calendar: '/calendar',
  organize: '/organize',
  study: '/study',
} as const;

const FILES_HUB_TABS: FilesHubTab[] = ['ask', 'focus', 'favorites'];

const isFilesHubTab = (value: string | undefined | null): value is FilesHubTab =>
  value === 'ask' || value === 'focus' || value === 'favorites';

const isFilesPath = (pathname: string) => pathname === PATHS.files || pathname.startsWith(`${PATHS.files}/`);

const filesTabFromPath = (pathname: string): FilesHubTab => {
  const match = pathname.match(/^\/files\/([^/]+)/);
  if (match && isFilesHubTab(match[1])) {
    return match[1];
  }
  return 'focus';
};

/** 旧 ?view= 与 sidePanelIntent.view → 路由 path */
const pathFromLegacyView = (view: string | null | undefined): string => {
  switch (view) {
    case 'organize':
      return PATHS.organize;
    case 'calendar':
      return PATHS.calendar;
    case 'browse':
      return PATHS.filesTab('focus');
    case 'ask':
      return PATHS.filesTab('ask');
    case 'chat':
      return PATHS.messages;
    case 'study':
      return PATHS.study;
    default:
      return PATHS.home;
  }
};

const bootstrapInitialEntry = (): string => {
  try {
    return pathFromLegacyView(new URLSearchParams(window.location.search).get('view'));
  } catch {
    return PATHS.home;
  }
};

const clearViewQuery = () => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('view')) {
      return;
    }
    url.searchParams.delete('view');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    // ignore
  }
};

export type { FilesHubTab };
export {
  PATHS,
  FILES_HUB_TABS,
  isFilesHubTab,
  isFilesPath,
  filesTabFromPath,
  pathFromLegacyView,
  bootstrapInitialEntry,
  clearViewQuery,
};
