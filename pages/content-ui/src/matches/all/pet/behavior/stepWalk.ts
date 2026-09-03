import { faceTowardsTarget, pickHorizontalTarget } from './wander';
import { ARRIVE_EPS } from '../constants';
import { clamp } from '../utils/bounds';
import type { PetBounds } from '../types';

type WalkPose = {
  x: number;
  y: number;
};

type WalkMotionState = {
  pos: WalkPose;
  target: WalkPose;
  facingLeft: boolean;
  walkLegsLeft: number;
};

/** 到达目标且腿程用尽 → 进入 idle；否则继续移动 / 换腿目标 */
type WalkStepResult =
  | { kind: 'idle' }
  | {
      kind: 'continue';
      pos: WalkPose;
      target: WalkPose;
      facingLeft: boolean;
      walkLegsLeft: number;
      facingDirty: boolean;
    };

/**
 * 纯函数：一帧水平散步步进（不含渲染 / 事件）。
 */
const stepWalk = (state: WalkMotionState, bounds: PetBounds, walkSpeed: number, dt: number): WalkStepResult => {
  const dx = state.target.x - state.pos.x;
  const dy = state.target.y - state.pos.y;
  const dist = Math.hypot(dx, dy);

  if (dist < ARRIVE_EPS) {
    if (state.walkLegsLeft > 0 || Math.random() < 0.7) {
      const walkLegsLeft = Math.max(0, state.walkLegsLeft - 1);
      const next = pickHorizontalTarget(bounds, state.pos.x, state.pos.y, state.facingLeft, true);
      return {
        kind: 'continue',
        pos: state.pos,
        target: { x: next.x, y: next.y },
        facingLeft: next.goLeft,
        walkLegsLeft,
        facingDirty: next.goLeft !== state.facingLeft,
      };
    }
    return { kind: 'idle' };
  }

  const step = walkSpeed * dt;
  const ratio = Math.min(1, step / dist);
  const nextX = clamp(state.pos.x + dx * ratio, bounds.minX, bounds.maxX);
  const nextY = clamp(state.pos.y + dy * Math.min(1, ratio * 1.8), bounds.minY, bounds.maxY);

  const hitLeft = nextX <= bounds.minX + 0.5;
  const hitRight = nextX >= bounds.maxX - 0.5;

  if (hitLeft || hitRight) {
    const next = pickHorizontalTarget(bounds, nextX, nextY, state.facingLeft, true);
    return {
      kind: 'continue',
      pos: { x: nextX, y: nextY },
      target: { x: next.x, y: next.y },
      facingLeft: next.goLeft,
      walkLegsLeft: Math.max(state.walkLegsLeft, 1),
      facingDirty: next.goLeft !== state.facingLeft,
    };
  }

  const nextFacing = faceTowardsTarget(nextX, state.target.x);
  const facingLeft = nextFacing ?? state.facingLeft;
  return {
    kind: 'continue',
    pos: { x: nextX, y: nextY },
    target: state.target,
    facingLeft,
    walkLegsLeft: state.walkLegsLeft,
    facingDirty: nextFacing !== null && nextFacing !== state.facingLeft,
  };
};

export { stepWalk };
export type { WalkMotionState, WalkStepResult };
