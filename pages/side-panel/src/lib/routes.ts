/** 侧栏 MemoryRouter 路径约定 */

type FilesHubTab = 'ask' | 'focus' | 'favorites';
type StudyTab = 'organize' | 'exam' | 'review';

const PATHS = {
  home: '/',
  files: '/files',
  filesTab: (tab: FilesHubTab) => `/files/${tab}`,
  messages: '/messages',
  calendar: '/calendar',
  organize: '/organize',
  study: '/study',
  studyTab: (tab: StudyTab) => `/study/${tab}`,
} as const;

const FILES_HUB_TABS: FilesHubTab[] = ['ask', 'focus', 'favorites'];
const STUDY_TABS: StudyTab[] = ['organize', 'exam', 'review'];

const isFilesHubTab = (value: string | undefined | null): value is FilesHubTab =>
  value === 'ask' || value === 'focus' || value === 'favorites';

const isStudyTab = (value: string | undefined | null): value is StudyTab =>
  value === 'organize' || value === 'exam' || value === 'review';

const isFilesPath = (pathname: string) => pathname === PATHS.files || pathname.startsWith(`${PATHS.files}/`);

const isStudyPath = (pathname: string) => pathname === PATHS.study || pathname.startsWith(`${PATHS.study}/`);

const filesTabFromPath = (pathname: string): FilesHubTab => {
  const match = pathname.match(/^\/files\/([^/]+)/);
  if (match && isFilesHubTab(match[1])) {
    return match[1];
  }
  return 'focus';
};

const studyTabFromPath = (pathname: string): StudyTab => {
  const match = pathname.match(/^\/study\/([^/]+)/);
  if (match && isStudyTab(match[1])) {
    return match[1];
  }
  return 'organize';
};

/** 旧 ?view= / sidePanelIntent.view → 路由 path */
const LEGACY_VIEW_PATH: Record<string, string> = {
  organize: PATHS.organize,
  calendar: PATHS.calendar,
  browse: PATHS.filesTab('focus'),
  ask: PATHS.filesTab('ask'),
  chat: PATHS.messages,
  study: PATHS.studyTab('organize'),
};

const pathFromLegacyView = (view: string | null | undefined): string => (view && LEGACY_VIEW_PATH[view]) || PATHS.home;

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

export type { FilesHubTab, StudyTab };
export {
  PATHS,
  FILES_HUB_TABS,
  STUDY_TABS,
  isFilesHubTab,
  isStudyTab,
  isFilesPath,
  isStudyPath,
  filesTabFromPath,
  studyTabFromPath,
  pathFromLegacyView,
  bootstrapInitialEntry,
  clearViewQuery,
};
