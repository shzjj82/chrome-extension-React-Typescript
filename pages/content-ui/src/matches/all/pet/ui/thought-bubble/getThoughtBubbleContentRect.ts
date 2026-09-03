import { getThoughtBubbleGeometry } from './thoughtBubbleGeometry';
import type { ThoughtBubbleSize } from './thoughtBubbleGeometry';

type Point = { x: number; y: number };

type ThoughtBubbleContentRect = {
  /** 相对 viewBox 左上角 */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 便于直接写成 CSS */
  top: number;
  left: number;
};

type GetThoughtBubbleContentRectOptions = {
  size?: ThoughtBubbleSize;
  /** SVG path `d`，默认取 size 对应云朵（不含尾巴圆点） */
  pathD?: string;
  viewBox?: { width: number; height: number };
  /** 描边半宽内缩，默认对齐 styles 里 stroke-width: 2.2 */
  strokeWidth?: number;
  /** 额外内边距（viewBox 单位） */
  padding?: number;
  /** 水平扫描线步长，越小越准、越慢 */
  sampleStep?: number;
  /** 每段三次贝塞尔采样点数 */
  bezierSegments?: number;
  /** 与 ThoughtBubbleShape 的 scaleX(-1) 同步，镜像文案区 */
  mirrorX?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

/** 三次贝塞尔上均匀采样（含终点） */
const sampleCubic = (p0: Point, p1: Point, p2: Point, p3: Point, segments: number): Point[] => {
  const points: Point[] = [];
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const u = 1 - t;
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return points;
};

/**
 * 解析仅含 M / C / Z 的 path（当前云朵 path 形态），展成闭合折线。
 */
const pathToPolygon = (pathD: string, bezierSegments: number): Point[] => {
  const tokens = pathD.match(/[MCZ]|-?\d*\.?\d+/gi);
  if (!tokens?.length) {
    return [];
  }

  const points: Point[] = [];
  let i = 0;
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const readNumber = () => {
    const raw = tokens[i++];
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid path number: ${raw}`);
    }
    return value;
  };

  while (i < tokens.length) {
    const command = tokens[i++].toUpperCase();
    if (command === 'M') {
      current = { x: readNumber(), y: readNumber() };
      start = current;
      points.push({ ...current });
      continue;
    }
    if (command === 'C') {
      while (i + 5 < tokens.length && !/^[MCZ]$/i.test(tokens[i] ?? '')) {
        const c1 = { x: readNumber(), y: readNumber() };
        const c2 = { x: readNumber(), y: readNumber() };
        const end = { x: readNumber(), y: readNumber() };
        points.push(...sampleCubic(current, c1, c2, end, bezierSegments));
        current = end;
      }
      continue;
    }
    if (command === 'Z') {
      current = start;
      continue;
    }
    // 容错：未知 token 当作数字残留则跳过
    if (!Number.isFinite(Number(command))) {
      throw new Error(`Unsupported path command: ${command}`);
    }
  }

  return points;
};

/** 水平线 y 与多边形边的交点 x（奇偶填充，简单外轮廓） */
const chordAtY = (polygon: Point[], y: number): { left: number; right: number } | null => {
  const xs: number[] = [];
  const count = polygon.length;

  for (let index = 0; index < count; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % count];
    if (!a || !b) {
      continue;
    }
    // 只在「向上跨越」时计入，避免顶点重复
    const aAbove = a.y > y;
    const bAbove = b.y > y;
    if (aAbove === bAbove) {
      continue;
    }
    const t = (y - a.y) / (b.y - a.y);
    xs.push(a.x + t * (b.x - a.x));
  }

  if (xs.length < 2) {
    return null;
  }

  xs.sort((left, right) => left - right);
  // 取最外一对：适合无洞的单连通云朵
  const left = xs[0];
  const right = xs[xs.length - 1];
  if (left === undefined || right === undefined || right - left <= 0) {
    return null;
  }
  return { left, right };
};

/**
 * 在 path 围成的区域内求适合排版的轴对齐内接矩形：
 * 先找最大面积，再在接近最大面积的候选里选更靠近云朵质心的，减少「贴边」观感。
 */
const getThoughtBubbleContentRect = (options: GetThoughtBubbleContentRectOptions = {}): ThoughtBubbleContentRect => {
  const geometry = getThoughtBubbleGeometry(options.size ?? 'sm');
  const {
    pathD = geometry.cloudPath,
    viewBox = geometry.viewBox,
    strokeWidth = 2.2,
    padding = 2,
    sampleStep = 0.5,
    bezierSegments = 12,
    /** SVG scaleX(-1) 时需水平镜像文案区 */
    mirrorX = false,
  } = options;

  const polygon = pathToPolygon(pathD, bezierSegments);
  if (polygon.length < 3) {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    sumX += point.x;
    sumY += point.y;
  }
  const centroidX = sumX / polygon.length;
  const centroidY = sumY / polygon.length;
  // 视觉中心取 path 包围盒中心与顶点质心的折中，避免贴上/贴侧
  const targetX = ((minX + maxX) / 2 + centroidX) / 2;
  const targetY = ((minY + maxY) / 2 + centroidY) / 2;

  const inset = strokeWidth / 2 + padding;
  const yStart = minY + inset;
  const yEnd = maxY - inset;
  if (yEnd <= yStart) {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 };
  }

  const ys: number[] = [];
  for (let y = yStart; y <= yEnd + 1e-9; y += sampleStep) {
    ys.push(y);
  }
  if (ys[ys.length - 1] !== undefined && ys[ys.length - 1]! < yEnd) {
    ys.push(yEnd);
  }

  type Candidate = { x: number; y: number; width: number; height: number; area: number };
  const candidates: Candidate[] = [];
  let maxArea = -1;

  for (let topIndex = 0; topIndex < ys.length; topIndex += 1) {
    let left = -Infinity;
    let right = Infinity;
    const top = ys[topIndex];
    if (top === undefined) {
      continue;
    }

    for (let bottomIndex = topIndex; bottomIndex < ys.length; bottomIndex += 1) {
      const bottom = ys[bottomIndex];
      if (bottom === undefined) {
        continue;
      }
      const chord = chordAtY(polygon, bottom);
      if (!chord) {
        break;
      }
      left = Math.max(left, chord.left + inset);
      right = Math.min(right, chord.right - inset);
      if (right - left <= 0) {
        break;
      }

      const width = right - left;
      const height = bottom - top;
      const area = width * height;
      if (area > maxArea) {
        maxArea = area;
      }
      candidates.push({ x: left, y: top, width, height, area });
    }
  }

  if (maxArea < 0 || candidates.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 };
  }

  // 面积不低于最大面积 88% 的候选里，选更靠近视觉中心的
  const areaFloor = maxArea * 0.88;
  let best = candidates[0]!;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    if (candidate.area < areaFloor) {
      continue;
    }
    const cx = candidate.x + candidate.width / 2;
    const cy = candidate.y + candidate.height / 2;
    const dx = (cx - targetX) / Math.max(1, maxX - minX);
    const dy = (cy - targetY) / Math.max(1, maxY - minY);
    // 归一化后强调居中；面积仍作轻微加分
    const score = dx * dx * 1.1 + dy * dy * 1.6 - (candidate.area / maxArea) * 0.08;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  let x = round1(clamp(best.x, 0, viewBox.width));
  const y = round1(clamp(best.y, 0, viewBox.height));
  const width = round1(clamp(best.width, 0, viewBox.width - x));
  const height = round1(clamp(best.height, 0, viewBox.height - y));

  if (mirrorX) {
    x = round1(viewBox.width - x - width);
  }

  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
  };
};

export { getThoughtBubbleContentRect };
export type { GetThoughtBubbleContentRectOptions, ThoughtBubbleContentRect };
