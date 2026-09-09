import { onDesktopLifecycle } from './registry';
import { useEffect, useRef } from 'react';
import type { DesktopLifecycleEvent } from './types';

/** 订阅桌面生命周期；未传入 listener 时不挂监听，避免点击打开时空跑 */
const useDesktopLifecycle = (listener?: ((event: DesktopLifecycleEvent) => void) | null) => {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  const enabled = Boolean(listener);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return onDesktopLifecycle(event => {
      listenerRef.current?.(event);
    });
  }, [enabled]);
};

export { useDesktopLifecycle };
