import { useEffect, useState } from 'react';

const useThoughtBubbleEnter = (visible: boolean) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  return entered;
};

export { useThoughtBubbleEnter };
