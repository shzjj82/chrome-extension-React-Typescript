import { useAppHeaderState } from './context';
import BackIconButton from '../../components/back-icon-button';
import { isFilesPath, PATHS } from '../../lib/routes';
import { useLocation } from 'react-router-dom';

type AppPageHeaderProps = {
  /** 默认返回（通常回桌面）；页面可通过 useAppHeader 覆盖 */
  defaultOnBack: () => void;
};

const TITLE_BY_PATH: Record<string, string> = {
  [PATHS.messages]: '短信',
  [PATHS.calendar]: '日历',
  [PATHS.organize]: '开始整理',
  [PATHS.study]: '学习',
};

/** 内页顶栏 layout：返回 + 标题 + 右侧槽位（首页不挂载） */
const AppPageHeader = ({ defaultOnBack }: AppPageHeaderProps) => {
  const header = useAppHeaderState();
  const location = useLocation();
  const fallbackTitle = isFilesPath(location.pathname) ? '' : (TITLE_BY_PATH[location.pathname] ?? '');
  const title = header?.title ?? fallbackTitle;
  const onBack = header?.onBack ?? defaultOnBack;
  const trailing = header?.trailing;

  return (
    <header className="app-page-header">
      <BackIconButton className="app-page-header__back" iconSize={16} onClick={onBack} />
      <h1 className="app-page-header__title">{title}</h1>
      <div className="app-page-header__trailing">
        {trailing ?? <span className="app-page-header__spacer" aria-hidden="true" />}
      </div>
    </header>
  );
};

export { AppPageHeader };
export { AppHeaderProvider, useAppHeader, useAppHeaderState } from './context';
export type { AppHeaderConfig } from './context';
