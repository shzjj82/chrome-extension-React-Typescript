import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type AppRevealPhase = 'open' | 'close';

type AppRevealOverlayProps = {
  active: boolean;
  phase: AppRevealPhase;
  originX: number;
  originY: number;
  onDone: () => void;
};

const OPEN_MS = 520;
const CLOSE_MS = 420;

const AppRevealOverlay = ({ active, phase, originX, originY, onDone }: AppRevealOverlayProps) => {
  const [expanded, setExpanded] = useState(phase === 'close');

  useEffect(() => {
    if (!active) {
      return;
    }
    setExpanded(phase === 'close');
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setExpanded(phase === 'open');
      });
    });
    const timer = window.setTimeout(onDone, phase === 'open' ? OPEN_MS : CLOSE_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [active, phase, onDone]);

  if (!active) {
    return null;
  }

  return (
    <div
      className={`phone-reveal${expanded ? 'phone-reveal--expanded' : ''}${phase === 'close' ? 'phone-reveal--closing' : ''}`}
      style={
        {
          '--reveal-x': `${originX}px`,
          '--reveal-y': `${originY}px`,
        } as CSSProperties
      }
      aria-hidden="true">
      <div className="phone-reveal__scene">
        <svg className="phone-reveal__spinner" viewBox="0 0 50 50">
          <circle className="phone-reveal__track" cx="25" cy="25" r="20" fill="none" />
          <circle className="phone-reveal__arc" cx="25" cy="25" r="20" fill="none" />
        </svg>
      </div>
    </div>
  );
};

export type { AppRevealPhase };
export default AppRevealOverlay;
