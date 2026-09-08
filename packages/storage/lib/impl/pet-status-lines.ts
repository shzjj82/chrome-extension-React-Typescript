/**
 * 宠物状态台词注册表 —— 与 PetController / 动画解耦。
 * 业务在启动时 register；结算后用 resolve / pick 按占比命中台词。
 */
import { buildDefaultPetNeedsConfig, settleAndPersistPetStats, settlePetStats } from './pet-needs.js';
import { clampStat, normalizePetStats } from './pet-stats-storage.js';
import type { PetNeedsConfig } from './pet-needs.js';
import type { PetStatsType } from './pet-stats-storage.js';

type PetStatusStat = 'hunger' | 'mood' | 'growth';

/**
 * 占比条件（stat 为 0–100，即百分比）。
 * - lte / gte / lt / gt：单阈值
 * - between：闭区间 [min, max]
 * 多项同时写时需全部满足（AND）
 */
type PetStatusThreshold = {
  lte?: number;
  gte?: number;
  lt?: number;
  gt?: number;
  between?: { min: number; max: number };
};

type PetStatusLineDef = {
  /** 唯一 id，重复 register 默认覆盖 */
  id: string;
  /** 监听的属性 */
  stat: PetStatusStat;
  /** 占比触发条件 */
  when: PetStatusThreshold;
  /** 命中后可选的台词（注册时写入；多条则按权重随机） */
  lines: readonly string[];
  /** 相对优先级，越大越优先；默认 0 */
  priority?: number;
  /** 同 id 冷却（毫秒），避免刷屏；默认 0 */
  cooldownMs?: number;
  /** 抽台词权重；默认 1 */
  weight?: number;
  /** 可选分组，便于业务批量卸载 */
  group?: string;
};

type PetStatusLineMatch = {
  def: PetStatusLineDef;
  /** 当前该属性值 0–100 */
  value: number;
  /** 从 lines 中选出的一句 */
  text: string;
};

type RegisterPetStatusLineOptions = {
  overwrite?: boolean;
};

const registry = new Map<string, PetStatusLineDef>();
/** 进程内冷却：id → 上次触发时间 */
const lastTriggeredAt = new Map<string, number>();

const normalizeThresholdBound = (value: number | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  return clampStat(value);
};

const normalizeThreshold = (when: PetStatusThreshold): PetStatusThreshold => {
  const between =
    when.between == null
      ? undefined
      : {
          min: clampStat(when.between.min),
          max: clampStat(when.between.max),
        };
  return {
    lte: normalizeThresholdBound(when.lte),
    gte: normalizeThresholdBound(when.gte),
    lt: normalizeThresholdBound(when.lt),
    gt: normalizeThresholdBound(when.gt),
    between: between && between.min > between.max ? { min: between.max, max: between.min } : between,
  };
};

const normalizeLines = (lines: readonly string[]) => lines.map(line => line.trim()).filter(line => line.length > 0);

const normalizeDef = (def: PetStatusLineDef): PetStatusLineDef => {
  const lines = normalizeLines(def.lines);
  if (!def.id.trim()) {
    throw new Error('Pet status line id is required');
  }
  if (lines.length === 0) {
    throw new Error(`Pet status line "${def.id}" needs at least one non-empty line`);
  }
  return {
    ...def,
    id: def.id.trim(),
    when: normalizeThreshold(def.when),
    lines,
    priority: def.priority ?? 0,
    cooldownMs: Math.max(0, Math.floor(def.cooldownMs ?? 0)),
    weight: Math.max(0, def.weight ?? 1),
    group: def.group?.trim() || undefined,
  };
};

const matchesThreshold = (value: number, when: PetStatusThreshold) => {
  if (when.lte != null && !(value <= when.lte)) {
    return false;
  }
  if (when.gte != null && !(value >= when.gte)) {
    return false;
  }
  if (when.lt != null && !(value < when.lt)) {
    return false;
  }
  if (when.gt != null && !(value > when.gt)) {
    return false;
  }
  if (when.between != null) {
    if (value < when.between.min || value > when.between.max) {
      return false;
    }
  }
  const hasAny = when.lte != null || when.gte != null || when.lt != null || when.gt != null || when.between != null;
  return hasAny;
};

const pickWeightedLine = (lines: readonly string[], weight: number, random = Math.random) => {
  if (lines.length === 1) {
    return lines[0]!;
  }
  // 单 def 内等权；weight 预留给同优先级多 def 扩展
  void weight;
  const index = Math.floor(random() * lines.length);
  return lines[Math.min(lines.length - 1, Math.max(0, index))]!;
};

const isCoolingDown = (id: string, cooldownMs: number, now: number) => {
  if (cooldownMs <= 0) {
    return false;
  }
  const last = lastTriggeredAt.get(id) ?? 0;
  return now - last < cooldownMs;
};

/** 注册一条状态台词（台词内容在注册时提供） */
const registerPetStatusLine = (def: PetStatusLineDef, options: RegisterPetStatusLineOptions = {}) => {
  const normalized = normalizeDef(def);
  if (registry.has(normalized.id) && options.overwrite === false) {
    return false;
  }
  registry.set(normalized.id, normalized);
  return true;
};

const registerPetStatusLines = (defs: readonly PetStatusLineDef[], options?: RegisterPetStatusLineOptions) => {
  defs.forEach(def => {
    registerPetStatusLine(def, options);
  });
};

const unregisterPetStatusLine = (id: string) => {
  lastTriggeredAt.delete(id);
  return registry.delete(id);
};

const unregisterPetStatusLineGroup = (group: string) => {
  const target = group.trim();
  if (!target) {
    return 0;
  }
  let removed = 0;
  for (const [id, def] of registry) {
    if (def.group === target) {
      registry.delete(id);
      lastTriggeredAt.delete(id);
      removed += 1;
    }
  }
  return removed;
};

const clearPetStatusLines = () => {
  registry.clear();
  lastTriggeredAt.clear();
};

const listPetStatusLines = (): PetStatusLineDef[] => [...registry.values()];

/** 列出当前命中的全部规则（不含冷却过滤可选） */
const listMatchingPetStatusLines = (
  stats: PetStatsType,
  options?: { ignoreCooldown?: boolean; now?: number; random?: () => number },
): PetStatusLineMatch[] => {
  const safe = normalizePetStats(stats);
  const now = options?.now ?? Date.now();
  const random = options?.random ?? Math.random;
  const matches: PetStatusLineMatch[] = [];

  for (const def of registry.values()) {
    const value = safe[def.stat];
    if (!matchesThreshold(value, def.when)) {
      continue;
    }
    if (!options?.ignoreCooldown && isCoolingDown(def.id, def.cooldownMs ?? 0, now)) {
      continue;
    }
    matches.push({
      def,
      value,
      text: pickWeightedLine(def.lines, def.weight ?? 1, random),
    });
  }

  return matches.sort((a, b) => (b.def.priority ?? 0) - (a.def.priority ?? 0));
};

/**
 * 选出一条最高优先级台词；调用后写入冷却。
 * 无命中返回 null。
 */
const pickPetStatusLine = (
  stats: PetStatsType,
  options?: { now?: number; random?: () => number; markTriggered?: boolean },
): PetStatusLineMatch | null => {
  const now = options?.now ?? Date.now();
  const matches = listMatchingPetStatusLines(stats, {
    now,
    random: options?.random,
    ignoreCooldown: false,
  });
  if (matches.length === 0) {
    return null;
  }

  const topPriority = matches[0]!.def.priority ?? 0;
  const top = matches.filter(item => (item.def.priority ?? 0) === topPriority);
  const chosen = top[Math.floor((options?.random ?? Math.random)() * top.length)] ?? matches[0]!;

  if (options?.markTriggered !== false) {
    lastTriggeredAt.set(chosen.def.id, now);
  }
  return chosen;
};

/** 先 settle（纯函数），再 pick —— 不写 storage */
const pickPetStatusLineAfterSettle = (
  stats: PetStatsType,
  now = Date.now(),
  config?: Partial<PetNeedsConfig>,
  options?: { random?: () => number; markTriggered?: boolean },
) => {
  const resolved: PetNeedsConfig = {
    ...buildDefaultPetNeedsConfig(),
    ...config,
    windows: {
      ...buildDefaultPetNeedsConfig().windows,
      ...config?.windows,
    },
    bands: {
      ...buildDefaultPetNeedsConfig().bands,
      ...config?.bands,
    },
  };
  const settled = settlePetStats(stats, now, resolved);
  return { stats: settled, match: pickPetStatusLine(settled, { now, ...options }) };
};

/** 持久化 settle 后 pick（供 Popup / content-ui / background 调用） */
const settleAndPickPetStatusLine = async (
  now = Date.now(),
  config?: Partial<PetNeedsConfig>,
  options?: { random?: () => number; markTriggered?: boolean },
) => {
  const stats = await settleAndPersistPetStats(now, config);
  return { stats, match: pickPetStatusLine(stats, { now, ...options }) };
};

export type { PetStatusStat, PetStatusThreshold, PetStatusLineDef, PetStatusLineMatch, RegisterPetStatusLineOptions };

export {
  registerPetStatusLine,
  registerPetStatusLines,
  unregisterPetStatusLine,
  unregisterPetStatusLineGroup,
  clearPetStatusLines,
  listPetStatusLines,
  listMatchingPetStatusLines,
  pickPetStatusLine,
  pickPetStatusLineAfterSettle,
  settleAndPickPetStatusLine,
};
