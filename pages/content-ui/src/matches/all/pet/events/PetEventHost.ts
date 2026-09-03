import { DEFAULT_EVENT_LIFECYCLES } from './types';
import type { PetEventFireArgs } from './payloadMap';
import type {
  PetEventDefinition,
  PetEventHook,
  PetEventHookContext,
  PetEventLifecycle,
  PetEventListenTopic,
  PetEventRegisterOptions,
  PetEventRuntime,
} from './types';

const toTopic = (eventId: string, lifecycle: PetEventLifecycle) => `${eventId}:${lifecycle}`;

/**
 * 事件主机：注册表 + fire + 统一生命周期钩子。
 * 常规 / 触发 / 反馈 监听方式相同。
 */
class PetEventHost {
  private readonly defs = new Map<string, PetEventDefinition>();
  private readonly hooksByTopic = new Map<string, Set<PetEventHook>>();
  private runtime: PetEventRuntime | null = null;
  private activeRegularId: string | null = null;
  private lastScheduleAt = 0;
  private warnUnknownLifecycle = true;

  bindRuntime = (runtime: PetEventRuntime) => {
    this.runtime = runtime;
  };

  register = (def: PetEventDefinition, options: PetEventRegisterOptions = {}) => {
    if (this.defs.has(def.id) && !options.overwrite) {
      return;
    }
    this.defs.set(def.id, {
      ...def,
      lifecycles: def.lifecycles ?? DEFAULT_EVENT_LIFECYCLES,
      execute: def.execute ?? (() => undefined),
    });
  };

  registerMany = (defs: PetEventDefinition[], options?: PetEventRegisterOptions) => {
    defs.forEach(def => this.register(def, options));
  };

  getDefinition = (eventId: string) => this.defs.get(eventId);

  list = (kind?: PetEventDefinition['kind']) =>
    [...this.defs.values()].filter(def => (kind ? def.kind === kind : true));

  /**
   * 统一监听：on('*') | on('*:*') | on('run') | on('run:start') | on('anim:frame')
   * `*` 不含 frame；需要帧回调用 `*:*` 或 `anim:frame`
   */
  on = (topic: PetEventListenTopic, hook: PetEventHook) => {
    const key = topic || '*';
    const bucket = this.hooksByTopic.get(key) ?? new Set();
    bucket.add(hook);
    this.hooksByTopic.set(key, bucket);
    return () => this.hooksByTopic.get(key)?.delete(hook);
  };

  /** @deprecated 使用 on(eventId, hook) */
  onEvent = (eventId: string, hook: PetEventHook) => this.on(eventId, hook);

  fire = <K extends string>(eventId: K, ...args: PetEventFireArgs<K>) => {
    const payload = args[0] as unknown;
    const def = this.defs.get(eventId);
    if (!def || !this.runtime) {
      return false;
    }

    if (def.kind === 'regular' && this.activeRegularId && this.activeRegularId !== eventId) {
      this.emit(this.activeRegularId, 'end');
    }
    if (def.kind === 'regular') {
      this.activeRegularId = eventId;
    }

    const ctx = this.buildContext(def, 'start', payload);
    def.execute?.(ctx, this.runtime);
    this.notify(ctx);
    return true;
  };

  emit = (eventId: string, lifecycle: PetEventLifecycle, payload?: unknown) => {
    const def = this.defs.get(eventId);
    if (!def || !this.runtime) {
      return;
    }

    const allowed = def.lifecycles ?? DEFAULT_EVENT_LIFECYCLES;
    if (!allowed.includes(lifecycle)) {
      if (this.warnUnknownLifecycle) {
        console.warn(`[PetEventHost] lifecycle "${lifecycle}" not in ${eventId}.lifecycles`, [...allowed]);
      }
      return;
    }

    if (lifecycle === 'start' && def.kind === 'regular') {
      this.activeRegularId = eventId;
    }

    if (lifecycle === 'end') {
      const ctx = this.buildContext(def, 'end', payload);
      def.onEnd?.(ctx, this.runtime);
      this.notify(ctx);
      if (def.kind === 'regular' && this.activeRegularId === eventId) {
        this.activeRegularId = null;
      }
      return;
    }

    this.notify(this.buildContext(def, lifecycle, payload));
  };

  update = (eventId: string, payload?: unknown) => {
    this.emit(eventId, 'update', payload);
  };

  /** 按权重抽一条常规事件；minGapMs 防止 rest 决策帧内连抽 */
  scheduleRegular = (options?: { minGapMs?: number }) => {
    const minGapMs = options?.minGapMs ?? 600;
    const now = performance.now();
    if (now - this.lastScheduleAt < minGapMs) {
      return false;
    }

    const regulars = this.list('regular').filter(def => (def.weight ?? 1) > 0);
    if (regulars.length === 0) {
      return false;
    }
    // 已在 idle 时优先抽 run，避免反复 fire idle
    const pool = this.activeRegularId === 'idle' ? regulars.filter(def => def.id !== 'idle') : regulars;
    const candidates = pool.length > 0 ? pool : regulars;
    const total = candidates.reduce((sum, def) => sum + (def.weight ?? 1), 0);
    let cursor = Math.random() * total;
    for (const def of candidates) {
      cursor -= def.weight ?? 1;
      if (cursor <= 0) {
        this.lastScheduleAt = now;
        return this.fire(def.id);
      }
    }
    this.lastScheduleAt = now;
    return this.fire(candidates[candidates.length - 1]!.id);
  };

  clear = () => {
    this.defs.clear();
    this.hooksByTopic.clear();
    this.activeRegularId = null;
    this.lastScheduleAt = 0;
    this.runtime = null;
  };

  private buildContext = (
    def: PetEventDefinition,
    lifecycle: PetEventLifecycle,
    payload?: unknown,
  ): PetEventHookContext => {
    const snap = this.runtime!.getSnapshot();
    return {
      eventId: def.id,
      kind: def.kind,
      lifecycle,
      topic: toTopic(def.id, lifecycle),
      position: snap.position,
      facingLeft: snap.facingLeft,
      mode: snap.mode,
      motionPhase: snap.motionPhase,
      payload,
      at: snap.at,
    };
  };

  private notify = (ctx: PetEventHookContext) => {
    // *:* 含全部（含 frame）
    this.hooksByTopic.get('*:*')?.forEach(hook => hook(ctx));
    // * 默认跳过 frame，避免刷屏
    if (ctx.lifecycle !== 'frame') {
      this.hooksByTopic.get('*')?.forEach(hook => hook(ctx));
    }
    this.hooksByTopic.get(ctx.eventId)?.forEach(hook => hook(ctx));
    this.hooksByTopic.get(ctx.topic)?.forEach(hook => hook(ctx));
  };
}

export { PetEventHost, toTopic };
