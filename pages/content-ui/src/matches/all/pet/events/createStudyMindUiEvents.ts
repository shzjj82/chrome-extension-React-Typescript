import { DEFAULT_EVENT_LIFECYCLES } from './types';
import type { PetEventDefinition } from './types';

/**
 * Study Mind 业务 UI 事件（不进宠物核心默认表）。
 * 在挂载宠物后 registerMany。
 */
const createStudyMindUiEvents = (): PetEventDefinition[] => [
  {
    id: 'look-clock',
    kind: 'trigger',
    lifecycles: DEFAULT_EVENT_LIFECYCLES,
  },
  {
    id: 'bubble',
    kind: 'trigger',
    lifecycles: DEFAULT_EVENT_LIFECYCLES,
  },
];

export { createStudyMindUiEvents };
