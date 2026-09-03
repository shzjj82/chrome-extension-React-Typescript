import { useId } from 'react';
import type { CSSProperties } from 'react';

type FocusClockProps = {
  facingLeft: boolean;
  /** 0–1 已走过的专注进度 */
  progress: number;
  /** 保留接口兼容；不再显示文字 */
  percentLabel: string;
};

const SIZE = 40;
const CX = SIZE / 2;
const CY = SIZE / 2;
const FACE_R = 16.2;
const TRACK_R = 14.5;
const TRACK_STROKE = 2.2;
const CIRCUMFERENCE = 2 * Math.PI * TRACK_R;

const polar = (angleDeg: number, radius: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * radius, y: CY + Math.sin(rad) * radius };
};

/** 专注圆形闹钟：时针固定 12 点，分针扫过进度夹角（不显示文字） */
const FocusClock = ({ facingLeft, progress }: FocusClockProps) => {
  const uid = useId().replace(/:/g, '');
  const softFilterId = `sm-focus-clock-soft-${uid}`;
  const faceGradId = `sm-focus-clock-face-${uid}`;
  const arcGradId = `sm-focus-clock-arc-${uid}`;
  const wedgeId = `sm-focus-clock-wedge-${uid}`;

  const clamped = Math.min(1, Math.max(0, progress));
  const sweepDeg = clamped * 360;
  const dashOffset = CIRCUMFERENCE * (1 - clamped);

  // 时针指向 12 点；分针按进度旋转，两者夹角 = 进度
  const hourAngle = 0;
  const minuteAngle = sweepDeg;
  const hourTip = polar(hourAngle, 7.2);
  const minuteTip = polar(minuteAngle, 11.2);

  const largeArc = sweepDeg > 180 ? 1 : 0;
  const wedgeEnd = polar(minuteAngle, TRACK_R - 1.2);
  const wedgePath =
    clamped <= 0.001
      ? ''
      : [
          `M ${CX} ${CY}`,
          `L ${CX} ${CY - (TRACK_R - 1.2)}`,
          `A ${TRACK_R - 1.2} ${TRACK_R - 1.2} 0 ${largeArc} 1 ${wedgeEnd.x} ${wedgeEnd.y}`,
          'Z',
        ].join(' ');

  const style: CSSProperties = {
    position: 'absolute',
    bottom: 60,
    width: SIZE,
    height: SIZE,
    zIndex: 3,
    pointerEvents: 'none',
    ...(facingLeft ? { left: -6 } : { right: -6 }),
  };

  return (
    <div className="sm-pet__focus-clock" style={style} aria-hidden="true">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} overflow="visible">
        <defs>
          <filter id={softFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" floodColor="#3d2e22" floodOpacity="0.2" />
          </filter>
          <linearGradient id={faceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffdf7" />
            <stop offset="100%" stopColor="#f6ebd8" />
          </linearGradient>
          <linearGradient id={arcGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          <linearGradient id={wedgeId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.14" />
          </linearGradient>
        </defs>

        <g filter={`url(#${softFilterId})`}>
          <circle cx={CX} cy={CY} r={FACE_R} fill={`url(#${faceGradId})`} stroke="#3d2e22" strokeWidth={1.55} />
          <circle cx={CX} cy={CY} r={TRACK_R} fill="none" stroke="rgba(61, 46, 34, 0.1)" strokeWidth={TRACK_STROKE} />
          <circle
            cx={CX}
            cy={CY}
            r={TRACK_R}
            fill="none"
            stroke={`url(#${arcGradId})`}
            strokeWidth={TRACK_STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />

          {Array.from({ length: 12 }, (_, index) => {
            const angle = (index / 12) * 360;
            const major = index % 3 === 0;
            const inner = polar(angle, TRACK_R - (major ? 3.1 : 2.1));
            const outer = polar(angle, TRACK_R - 0.55);
            return (
              <line
                key={index}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={major ? 'rgba(61, 46, 34, 0.5)' : 'rgba(61, 46, 34, 0.26)'}
                strokeWidth={major ? 1.3 : 0.85}
                strokeLinecap="round"
              />
            );
          })}

          {wedgePath ? <path d={wedgePath} fill={`url(#${wedgeId})`} /> : null}

          {/* 时针：固定 12 点 */}
          <line
            x1={CX}
            y1={CY}
            x2={hourTip.x}
            y2={hourTip.y}
            stroke="#3d2e22"
            strokeWidth={2.15}
            strokeLinecap="round"
          />
          {/* 分针：指向进度角度 */}
          <line
            x1={CX}
            y1={CY}
            x2={minuteTip.x}
            y2={minuteTip.y}
            stroke="#c2410c"
            strokeWidth={1.55}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={1.6} fill="#3d2e22" />
          <circle cx={CX} cy={CY} r={0.7} fill="#fff8ef" />
        </g>
      </svg>
    </div>
  );
};

export { FocusClock };
export type { FocusClockProps };
