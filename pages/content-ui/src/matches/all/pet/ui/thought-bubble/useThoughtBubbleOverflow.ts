import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** 检测内容是否相对容器发生裁切溢出 */
const useThoughtBubbleOverflow = (
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) => {
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      setTruncated(false);
      return;
    }

    const measure = () => {
      const overflowY = content.scrollHeight > container.clientHeight + 1;
      const overflowX = content.scrollWidth > container.clientWidth + 1;
      setTruncated(overflowY || overflowX);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 显式依赖列表由调用方传入
  }, deps);

  return truncated;
};

export { useThoughtBubbleOverflow };
