import { FACE_FLIP_MIN_DX } from '../constants';
import { clamp, rand } from '../utils/bounds';
import type { PetBounds } from '../types';

const pickHorizontalTarget = (
  bounds: PetBounds,
  fromX: number,
  fromY: number,
  facingLeft: boolean,
  preferTurn: boolean,
  preserveFacing = false,
) => {
  const laneY = clamp(fromY + (Math.random() < 0.12 ? rand(-10, 10) : 0), bounds.minY, bounds.maxY);
  const span = Math.max(0, bounds.maxX - bounds.minX);
  const minStep = Math.min(64, Math.max(24, span * 0.35));

  let goLeft = preserveFacing ? facingLeft : preferTurn || Math.random() < 0.72 ? !facingLeft : facingLeft;

  const roomLeft = fromX - bounds.minX;
  const roomRight = bounds.maxX - fromX;
  if (goLeft && roomLeft < minStep && roomRight >= minStep) {
    goLeft = false;
  } else if (!goLeft && roomRight < minStep && roomLeft >= minStep) {
    goLeft = true;
  }

  let nextX = goLeft
    ? rand(bounds.minX, Math.max(bounds.minX, fromX - minStep))
    : rand(Math.min(bounds.maxX, fromX + minStep), bounds.maxX);

  if (Math.abs(nextX - fromX) < 12) {
    nextX = goLeft ? bounds.minX : bounds.maxX;
    if (Math.abs(nextX - fromX) < 12) {
      nextX = goLeft ? bounds.maxX : bounds.minX;
      goLeft = nextX < fromX;
    }
  }

  return { x: nextX, y: laneY, goLeft };
};

const faceTowardsTarget = (fromX: number, toX: number) => {
  const dx = toX - fromX;
  if (Math.abs(dx) < FACE_FLIP_MIN_DX) {
    return null;
  }
  return dx < 0;
};

export { faceTowardsTarget, pickHorizontalTarget };
