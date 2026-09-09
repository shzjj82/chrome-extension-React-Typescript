import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type AppHeaderConfig = {
  title: string;
  onBack?: () => void;
  trailing?: ReactNode;
};

type AppHeaderSetter = (config: AppHeaderConfig | null) => void;

const AppHeaderStateContext = createContext<AppHeaderConfig | null>(null);
const AppHeaderSetContext = createContext<AppHeaderSetter | null>(null);

const AppHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [header, setHeader] = useState<AppHeaderConfig | null>(null);

  return (
    <AppHeaderSetContext.Provider value={setHeader}>
      <AppHeaderStateContext.Provider value={header}>{children}</AppHeaderStateContext.Provider>
    </AppHeaderSetContext.Provider>
  );
};

type UseAppHeaderOptions = {
  onBack?: () => void;
  trailing?: ReactNode;
  /** 顶栏右侧/返回语义变化时传入，避免 trailing 引用导致无限更新 */
  syncKey?: string | number | boolean | null;
  /** keepalive 页面离开路由时关掉，避免抢占其它页顶栏 */
  enabled?: boolean;
};

/** 非首页页面声明顶栏标题 / 返回 / 右侧操作；卸载时清空 */
const useAppHeader = (title: string, options?: UseAppHeaderOptions) => {
  const setHeader = useContext(AppHeaderSetContext);
  const onBackRef = useRef(options?.onBack);
  onBackRef.current = options?.onBack;
  const syncKey = options?.syncKey ?? null;
  const enabled = options?.enabled ?? true;

  useLayoutEffect(() => {
    if (!setHeader || !enabled) {
      return;
    }
    setHeader({
      title,
      onBack: () => onBackRef.current?.(),
      trailing: options?.trailing,
    });
    return () => {
      setHeader(null);
    };
    // trailing 随 syncKey 一并刷新，避免 JSX 引用进入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [setHeader, title, syncKey, enabled]);
};

const useAppHeaderState = () => useContext(AppHeaderStateContext);

export type { AppHeaderConfig };
export { AppHeaderProvider, useAppHeader, useAppHeaderState };
