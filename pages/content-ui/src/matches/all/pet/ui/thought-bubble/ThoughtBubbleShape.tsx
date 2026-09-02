type ThoughtBubbleShapeProps = {
  tailNearDog: 'left' | 'right';
};

const ThoughtBubbleShape = ({ tailNearDog }: ThoughtBubbleShapeProps) => (
  <svg
    className="sm-pet__thought-art"
    viewBox="0 0 108 88"
    aria-hidden="true"
    style={{ transform: tailNearDog === 'left' ? 'scaleX(-1)' : undefined }}>
    <path
      className="sm-pet__thought-cloud"
      d="M24 50 C14 50 10 36 18 28 C22 16 36 12 46 16 C54 9 68 11 76 20 C86 17 94 27 91 38 C98 45 93 55 83 58 C81 65 68 68 56 66 C44 69 30 64 24 56 Z"
    />
    <ellipse className="sm-pet__thought-dot" cx="84" cy="68" rx="6.5" ry="4.8" />
    <circle className="sm-pet__thought-dot sm-pet__thought-dot--small" cx="94" cy="80" r="3.2" />
  </svg>
);

export { ThoughtBubbleShape };
export type { ThoughtBubbleShapeProps };
