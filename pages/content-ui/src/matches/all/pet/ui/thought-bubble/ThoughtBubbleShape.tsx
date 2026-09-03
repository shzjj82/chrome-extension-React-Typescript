import { getThoughtBubbleGeometry } from './thoughtBubbleGeometry';
import type { ThoughtBubbleSize } from './thoughtBubbleGeometry';

type ThoughtBubbleShapeProps = {
  tailNearPet: 'left' | 'right';
  size?: ThoughtBubbleSize;
};

const ThoughtBubbleShape = ({ tailNearPet, size = 'sm' }: ThoughtBubbleShapeProps) => {
  const { viewBox, cloudPath, midDot, smallDot } = getThoughtBubbleGeometry(size);

  return (
    <svg
      className="sm-pet__thought-art"
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      width={viewBox.width}
      height={viewBox.height}
      aria-hidden="true"
      style={{ transform: tailNearPet === 'left' ? 'scaleX(-1)' : undefined }}>
      <path className="sm-pet__thought-cloud" d={cloudPath} />
      <ellipse className="sm-pet__thought-dot" cx={midDot.cx} cy={midDot.cy} rx={midDot.rx} ry={midDot.ry} />
      <circle
        className="sm-pet__thought-dot sm-pet__thought-dot--small"
        cx={smallDot.cx}
        cy={smallDot.cy}
        r={smallDot.r}
      />
    </svg>
  );
};

export { ThoughtBubbleShape };
export type { ThoughtBubbleShapeProps };
