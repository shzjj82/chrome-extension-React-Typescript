import { ANIM_EVENT_LIFECYCLES, DEFAULT_EVENT_LIFECYCLES, FEEDBACK_EVENT_LIFECYCLES } from './types';
import type { PetEventDefinition } from './types';

/**
 * 宠物核心默认事件（不含业务 UI：look-clock / bubble 由业务注册）。
 * - 行为与动画分离：run/idle 是行为；帧信号走独立 `anim` 频道
 */
const createDefaultPetEvents = (): PetEventDefinition[] => [
  // —— 常规行为 ——
  {
    id: 'run',
    kind: 'regular',
    weight: 3,
    builtin: true,
    animId: 'run',
    lifecycles: DEFAULT_EVENT_LIFECYCLES,
    execute: (_ctx, runtime) => {
      runtime.beginWalk();
    },
  },
  {
    id: 'idle',
    kind: 'regular',
    weight: 1,
    builtin: true,
    lifecycles: DEFAULT_EVENT_LIFECYCLES,
    execute: (_ctx, runtime) => {
      runtime.enterIdle();
    },
  },

  // —— 动画信号频道（与行为事件分离）——
  {
    id: 'anim',
    kind: 'trigger',
    builtin: true,
    lifecycles: ANIM_EVENT_LIFECYCLES,
  },

  // —— 用户行为反馈 ——
  {
    id: 'hover',
    kind: 'feedback',
    builtin: true,
    lifecycles: FEEDBACK_EVENT_LIFECYCLES,
  },
  {
    id: 'drag',
    kind: 'feedback',
    builtin: true,
    lifecycles: FEEDBACK_EVENT_LIFECYCLES,
  },
  {
    id: 'click',
    kind: 'feedback',
    builtin: true,
    lifecycles: ['start', 'end'],
  },

  // —— 通用姿态锁（陪伴能力，非特定 UI）——
  {
    id: 'focus-sit',
    kind: 'trigger',
    builtin: true,
    lifecycles: DEFAULT_EVENT_LIFECYCLES,
    execute: (_ctx, runtime) => {
      runtime.lockSit();
    },
    onEnd: (_ctx, runtime) => {
      runtime.unlockSit();
    },
  },
  {
    id: 'rest-prompt',
    kind: 'trigger',
    builtin: true,
    lifecycles: DEFAULT_EVENT_LIFECYCLES,
    execute: (_ctx, runtime) => {
      runtime.promptRestSit();
    },
    onEnd: (_ctx, runtime) => {
      runtime.clearRestPrompt();
    },
  },
];

export { createDefaultPetEvents };
