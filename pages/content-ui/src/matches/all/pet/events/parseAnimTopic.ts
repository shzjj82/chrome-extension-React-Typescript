import type { PetAnimSignalPayload, PetEventLifecycle } from './types';

/** 把渲染器 topic（如 run:start）解析为 anim 频道生命周期 + payload */
const parseAnimTopic = (
  topic: string,
  payload: unknown,
): { lifecycle: Extract<PetEventLifecycle, 'start' | 'frame' | 'complete'>; signal: PetAnimSignalPayload } | null => {
  const matched = /^([\w-]+):(start|frame|complete)$/.exec(topic);
  if (!matched) {
    return null;
  }
  const animId = matched[1];
  const phase = matched[2] as 'start' | 'frame' | 'complete';
  if (!animId) {
    return null;
  }
  const base = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  return {
    lifecycle: phase,
    signal: {
      animId,
      frame: typeof base.frame === 'number' ? base.frame : undefined,
      frames: typeof base.frames === 'number' ? base.frames : undefined,
      frameMs: typeof base.frameMs === 'number' ? base.frameMs : undefined,
      loop: typeof base.loop === 'boolean' ? base.loop : undefined,
    },
  };
};

export { parseAnimTopic };
