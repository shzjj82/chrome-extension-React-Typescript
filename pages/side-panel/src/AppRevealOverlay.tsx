import { useEffect, useState } from 'react';
import type { HomeAppTone } from './appCatalog';
import type { CSSProperties } from 'react';

type AppRevealOverlayProps = {
  active: boolean;
  originX: number;
  originY: number;
  tone: HomeAppTone;
  /** 色圆已铺满：此时切到目标页（仍被遮罩盖住） */
  onCovered: () => void;
  /** 遮罩淡出结束：卸掉遮罩 */
  onDone: () => void;
};

const EXPAND_MS = 480;
const FADE_MS = 320;

const TONE_FILL: Record<HomeAppTone, string> = {
  rose: 'linear-gradient(160deg, #ff6b6b 0%, #d64545 55%, #b83232 100%)',
  amber: 'linear-gradient(160deg, #ffc56b 0%, #e29a3a 55%, #c47b2a 100%)',
  ink: 'linear-gradient(160deg, #7a6354 0%, #4a382c 55%, #2f241c 100%)',
  sage: 'linear-gradient(160deg, #8fb089 0%, #628a5d 55%, #4a6b46 100%)',
  sky: 'linear-gradient(160deg, #6ec8ff 0%, #3b9ee8 55%, #2a7fc4 100%)',
  violet: 'linear-gradient(160deg, #b89cff 0%, #7b6adf 55%, #5a4bb8 100%)',
  coral: 'linear-gradient(160deg, #ff9b7a 0%, #e86b4a 55%, #c24f35 100%)',
};

/** 打开：色圆放大铺满 → 切页 → 淡出遮罩，过渡更自然 */
const AppRevealOverlay = ({ active, originX, originY, tone, onCovered, onDone }: AppRevealOverlayProps) => {
  const [expanded, setExpanded] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!active) {
      setExpanded(false);
      setFading(false);
      return;
    }

    setExpanded(false);
    setFading(false);

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setExpanded(true));
    });

    const coverTimer = window.setTimeout(() => {
      onCovered();
      setFading(true);
    }, EXPAND_MS);

    const doneTimer = window.setTimeout(() => {
      onDone();
    }, EXPAND_MS + FADE_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(coverTimer);
      window.clearTimeout(doneTimer);
    };
  }, [active, onCovered, onDone]);

  if (!active) {
    return null;
  }

  return (
    <div
      className={[
        'phone-reveal',
        expanded ? 'phone-reveal--expanded' : 'phone-reveal--compact',
        fading ? 'phone-reveal--fading' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--reveal-x': `${originX}px`,
          '--reveal-y': `${originY}px`,
          background: TONE_FILL[tone],
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
};

export default AppRevealOverlay;
