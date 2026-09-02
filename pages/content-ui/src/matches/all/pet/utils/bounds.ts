import { VIEW_SIZE, WANDER_MARGIN } from '../constants';
import type { PetBounds } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getWanderSize = () => ({
  width: Math.min(320, Math.max(180, window.innerWidth * 0.28)),
  height: Math.min(260, Math.max(160, window.innerHeight * 0.28)),
});

const getViewportLimits = () => ({
  maxX: window.innerWidth - WANDER_MARGIN - VIEW_SIZE,
  maxY: window.innerHeight - WANDER_MARGIN - VIEW_SIZE,
});

const defaultBounds = (): PetBounds => {
  const { width, height } = getWanderSize();
  const { maxX, maxY } = getViewportLimits();
  return {
    minX: Math.max(WANDER_MARGIN, maxX - width),
    maxX: Math.max(WANDER_MARGIN, maxX),
    minY: Math.max(WANDER_MARGIN, maxY - height),
    maxY: Math.max(WANDER_MARGIN, maxY),
  };
};

const resolveBounds = (partial?: Partial<PetBounds>): PetBounds => {
  const next = { ...defaultBounds(), ...partial };
  if (next.minX > next.maxX) {
    [next.minX, next.maxX] = [next.maxX, next.minX];
  }
  if (next.minY > next.maxY) {
    [next.minY, next.maxY] = [next.maxY, next.minY];
  }
  return next;
};

const boundsAround = (x: number, y: number): PetBounds => {
  const { width, height } = getWanderSize();
  const { maxX: limitX, maxY: limitY } = getViewportLimits();

  let minX = x - width / 2;
  let maxX = x + width / 2;
  let minY = y - height / 2;
  let maxY = y + height / 2;

  if (minX < WANDER_MARGIN) {
    maxX += WANDER_MARGIN - minX;
    minX = WANDER_MARGIN;
  }
  if (maxX > limitX) {
    minX -= maxX - limitX;
    maxX = limitX;
  }
  if (minY < WANDER_MARGIN) {
    maxY += WANDER_MARGIN - minY;
    minY = WANDER_MARGIN;
  }
  if (maxY > limitY) {
    minY -= maxY - limitY;
    maxY = limitY;
  }

  return {
    minX: clamp(minX, WANDER_MARGIN, limitX),
    maxX: clamp(maxX, WANDER_MARGIN, limitX),
    minY: clamp(minY, WANDER_MARGIN, limitY),
    maxY: clamp(maxY, WANDER_MARGIN, limitY),
  };
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export { boundsAround, clamp, defaultBounds, rand, resolveBounds };
