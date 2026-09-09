import PhoneStatusBar from '../../components/phone-status-bar';
import { isFilesPath, PATHS } from '../../lib/routes';
import { AppPageHeader } from '../app-header';
import { AppHeaderProvider } from '../app-header/context';
import { cn } from '@extension/ui';
import { Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

type PhoneChromeProps = {
  isLight: boolean;
  /** 强制按桌面样式（认养门闸等） */
  forceHome?: boolean;
  /** 非首页显示统一顶栏 */
  showHeader?: boolean;
  defaultOnBack?: () => void;
  /** 文件 Hub keepalive，挂在壳层避免随路由卸载 */
  filesSlot?: ReactNode;
  /** 非路由用法时传入 children；路由 layout 用 Outlet */
  children?: ReactNode;
};

/**
 * Layout A：全站壳（状态栏 + 底部安全横线）
 * Layout B：在非首页叠加 AppPageHeader（同一壳内判断）
 */
const PhoneChrome = ({
  isLight,
  forceHome = false,
  showHeader = false,
  defaultOnBack,
  filesSlot,
  children,
}: PhoneChromeProps) => {
  const location = useLocation();
  const isHome = forceHome || location.pathname === PATHS.home;
  const onFiles = isFilesPath(location.pathname);
  const headerVisible = Boolean(showHeader && !isHome && defaultOnBack);

  return (
    <AppHeaderProvider>
      <div
        className={cn(
          'side-panel phone-chrome',
          isHome && 'phone-home',
          !isLight && (isHome ? 'phone-home--dark' : 'phone-chrome--dark'),
        )}>
        {isHome ? <div className="phone-home__wallpaper" aria-hidden="true" /> : null}
        <PhoneStatusBar className={cn('phone-chrome__status', isHome && 'phone-home__status-bar')} clockLeft />
        {headerVisible ? <AppPageHeader defaultOnBack={defaultOnBack!} /> : null}
        <div className="phone-chrome__body">
          {filesSlot}
          <div className={cn('phone-chrome__outlet', onFiles && 'phone-chrome__outlet--hidden')}>
            {children ?? <Outlet />}
          </div>
        </div>
        <div className="phone-chrome__home-bar" aria-hidden="true" />
      </div>
    </AppHeaderProvider>
  );
};

type PhoneChromeLayoutProps = {
  isLight: boolean;
  onBack: () => void;
  filesSlot?: ReactNode;
};

/** 路由根 layout：全站壳 + 非首页顶栏判断 */
const PhoneChromeLayout = ({ isLight, onBack, filesSlot }: PhoneChromeLayoutProps) => (
  <PhoneChrome isLight={isLight} showHeader defaultOnBack={onBack} filesSlot={filesSlot} />
);

export { PhoneChrome, PhoneChromeLayout };
