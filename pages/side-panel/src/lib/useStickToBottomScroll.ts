import { useLayoutEffect, useRef } from 'react';
import type { UIEvent, WheelEvent } from 'react';

const BOTTOM_GAP_PX = 64;

/**
 * 流式吐字时：仅在「粘底」或调用方 pin 时自动滚到底。
 * 用户一旦上滑（滚轮/触摸/拖动）立即取消跟随，不打断阅读。
 */
const useStickToBottomScroll = (deps: unknown[]) => {
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const programmaticRef = useRef(false);

  const pinToBottom = () => {
    stickToBottomRef.current = true;
  };

  const scrollToBottomIfStuck = () => {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) {
      return;
    }
    programmaticRef.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      programmaticRef.current = false;
    });
  };

  useLayoutEffect(() => {
    scrollToBottomIfStuck();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 由调用方传入内容依赖
  }, deps);

  const syncStickFromScrollPosition = () => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = gap <= BOTTOM_GAP_PX;
  };

  const onScroll = (event?: UIEvent<HTMLDivElement>) => {
    if (programmaticRef.current) {
      return;
    }
    const el = event?.currentTarget ?? listRef.current;
    if (!el) {
      return;
    }
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = gap <= BOTTOM_GAP_PX;
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      stickToBottomRef.current = false;
      return;
    }
    if (event.deltaY > 0) {
      requestAnimationFrame(syncStickFromScrollPosition);
    }
  };

  const onTouchStart = () => {
    // 触摸开始不改状态；移动中由 onScroll / onTouchMove 更新
  };

  const onTouchMove = () => {
    if (programmaticRef.current) {
      return;
    }
    syncStickFromScrollPosition();
  };

  return {
    listRef,
    stickToBottomRef,
    pinToBottom,
    scrollToBottomIfStuck,
    onScroll,
    onWheel,
    onTouchStart,
    onTouchMove,
  };
};

export { useStickToBottomScroll, BOTTOM_GAP_PX };
