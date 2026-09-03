import { getPetKind } from './petKinds';
import { PetTopicBus } from './PetTopicBus';
import { PetSpriteRenderer } from '../animation/PetSpriteRenderer';
import { computeDragPosition, createDragSession } from '../behavior/dragSession';
import { stepWalk } from '../behavior/stepWalk';
import { pickHorizontalTarget } from '../behavior/wander';
import { attachWindowPointerSession } from '../behavior/windowPointer';
import { createDefaultPetEvents, PetEventHost, parseAnimTopic } from '../events';
import { boundsAround, clamp, rand, resolveBounds } from '../utils/bounds';
import type { PetKindId } from './petKinds';
import type { PetControllerState, PetTopic, PetTopicPayload } from './topics';
import type { DragSession } from '../behavior/dragSession';
import type {
  PetAnimSignalPayload,
  PetEventDefinition,
  PetEventFireArgs,
  PetEventHook,
  PetEventHookContext,
} from '../events';
import type { PetBounds, PetMode, PetPhase } from '../types';

type PetControllerOptions = {
  walkSpeed?: number;
  resumeDelayMs?: number;
  bounds?: Partial<PetBounds>;
  /** 固定 bounds，拖拽后不自动重算活动范围 */
  fixedBounds?: boolean;
  /** 宠物种类：认养前用 adoptable-pup（仅 idle 循环） */
  kind?: PetKindId;
};

type PetMountTarget = {
  root: HTMLElement;
  host: HTMLElement;
  hoverZone: HTMLElement;
};

/**
 * 桌面宠物行为控制器：散步 / 坐下 / 拖拽。
 * 事件通过 PetEventHost 工厂注册（常规 / 触发），业务用统一钩子监听。
 */
class PetController {
  private readonly topics = new PetTopicBus();
  private readonly events = new PetEventHost();

  private readonly walkSpeed: number;
  private readonly resumeDelayMs: number;
  private readonly fixedBounds: boolean;
  private readonly kindId: PetKindId;
  private readonly idleOnly: boolean;

  private bounds: PetBounds;
  private boundsOverride?: Partial<PetBounds>;

  private root: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private hoverZone: HTMLElement | null = null;

  private renderer: PetSpriteRenderer | null = null;
  private pos = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };

  private mode: PetMode = 'auto';
  private phase: PetPhase = 'walk';
  private facingLeft = false;

  private decisionAt = 0;
  private resumeTimer: number | null = null;
  private resumeFromSit = false;
  private isHovering = false;
  private restPrompt = false;
  /** 外部锁定坐下（如专注模式），离开 hover 不恢复散步 */
  private sitLock = false;
  private drag: DragSession | null = null;
  private detachDragWindow: (() => void) | null = null;

  private rafId: number | null = null;
  private lastTs: number | null = null;
  private walkLegsLeft = 0;

  private mounted = false;
  private disposed = false;
  private unsubAnimComplete: (() => void) | null = null;

  constructor(options: PetControllerOptions = {}) {
    this.walkSpeed = options.walkSpeed ?? 54;
    this.resumeDelayMs = options.resumeDelayMs ?? 2200;
    this.fixedBounds = options.fixedBounds ?? false;
    this.boundsOverride = options.bounds;
    this.bounds = resolveBounds(options.bounds);
    this.kindId = options.kind ?? 'study-buddy';
    this.idleOnly = getPetKind(this.kindId).behavior === 'idle-loop';
    if (this.idleOnly) {
      this.phase = 'rest';
    }

    this.events.registerMany(createDefaultPetEvents());
    this.events.bindRuntime({
      getSnapshot: () => ({
        position: { ...this.pos },
        facingLeft: this.facingLeft,
        mode: this.mode,
        motionPhase: this.phase,
        at: Date.now(),
      }),
      beginWalk: opts => this.beginWalkMotion(opts),
      enterIdle: holdMs => this.enterRest(performance.now(), holdMs),
      lockSit: () => this.lockSitImpl(),
      unlockSit: () => this.unlockSitImpl(),
      promptRestSit: () => this.promptRestSitImpl(),
      clearRestPrompt: () => this.clearRestPromptImpl(),
    });
  }

  getState = (): PetControllerState => ({
    facingLeft: this.facingLeft,
    mode: this.mode,
    phase: this.phase,
  });

  getPosition = () => ({ ...this.pos });

  /** 按主题订阅（内部/兼容用；业务请优先 onPetEvent） */
  subscribe = <T extends PetTopic>(topic: T, listener: (payload: PetTopicPayload[T]) => void) => {
    this.topics.subscribe(topic, listener);
  };

  unsubscribe = <T extends PetTopic>(topic: T, listener: (payload: PetTopicPayload[T]) => void) => {
    this.topics.unsubscribe(topic, listener);
  };

  /**
   * 统一事件钩子（常规 / 触发 / 反馈 同一套逻辑）
   * topic: '*' | '*:*' | 'run' | 'run:start' | 'anim:frame' | 'drag:end' | ...
   * 对外请优先用本 API；旧 subscribe(topic) 仅内部兼容。
   */
  onPetEvent = (topic: string, hook: PetEventHook) => this.events.on(topic, hook);

  onPetEventId = (eventId: string, hook: PetEventHook) => this.events.on(eventId, hook);

  registerPetEvents = (defs: PetEventDefinition[]) => {
    this.events.registerMany(defs, { overwrite: true });
  };

  /** 注册自定义事件（或覆盖） */
  registerPetEvent = (def: PetEventDefinition) => {
    this.events.register(def, { overwrite: true });
  };

  /** 触发事件（常规也可手动 fire）；已知 id 带 payload 类型 */
  fire = <K extends string>(eventId: K, ...args: PetEventFireArgs<K>) => this.events.fire(eventId, ...args);

  /** 结束事件生命周期 */
  endEvent = (eventId: string, payload?: unknown) => {
    this.events.emit(eventId, 'end', payload);
  };

  /** 更新触发事件 payload（不重跑 execute） */
  updateEvent = (eventId: string, payload?: unknown) => {
    this.events.update(eventId, payload);
  };

  updateOptions = (options: Partial<PetControllerOptions>) => {
    if (options.bounds !== undefined) {
      this.boundsOverride = options.bounds;
      this.bounds = resolveBounds(options.bounds);
      this.clampPositionToBounds();
    }
  };

  mount = (target: PetMountTarget) => {
    if (this.disposed) {
      return;
    }

    this.root = target.root;
    this.host = target.host;
    this.hoverZone = target.hoverZone;
    this.mounted = true;

    const startX = rand(this.bounds.minX, this.bounds.maxX);
    const startY = rand(this.bounds.minY, this.bounds.maxY);
    this.pos = { x: startX, y: startY };
    this.target = { x: startX, y: startY };
    this.applyRootPos(startX, startY);

    const kind = getPetKind(this.kindId);
    const renderer = new PetSpriteRenderer();
    this.renderer = renderer;
    renderer.setSkin(kind.skinId);
    renderer.setDefaultAnim(kind.defaultAnim);
    renderer.bindPublish((topic, payload) => {
      // 动画只进统一事件频道 anim:*，不再双发 Topic
      this.bridgeAnimTopicToEvents(String(topic), payload);
    });
    this.unsubAnimComplete = this.events.on('anim:complete', this.handleAnimComplete);
    renderer.mount(this.host);

    if (this.idleOnly) {
      this.playIdleLoop();
    } else {
      this.events.fire('run');
    }
    this.rafId = window.requestAnimationFrame(this.tick);
    window.addEventListener('resize', this.handleResize);
  };

  dispose = () => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.mounted = false;

    window.removeEventListener('resize', this.handleResize);
    this.clearResumeTimer();
    this.detachDragListeners();

    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.unsubAnimComplete?.();
    this.unsubAnimComplete = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.events.clear();
    this.topics.clear();
    this.root = null;
    this.host = null;
    this.hoverZone = null;
  };

  /** Hover 热区进入：直接走反馈事件 + 姿态 */
  notifyHoverEnter = () => {
    if (this.isDragging()) {
      return;
    }
    this.handleHoverEnterAnim();
  };

  /** Hover 热区离开 */
  notifyHoverLeave = () => {
    if (this.isDragging()) {
      return;
    }
    this.handleHoverLeaveAnim();
  };

  private isSitLocked = () => this.restPrompt || this.sitLock;

  private lockSitPose = () => {
    this.clearResumeTimer();
    this.mode = 'hover';
    this.phase = 'rest';
    if (this.idleOnly) {
      this.playIdleLoop();
      return;
    }
    if (!this.isSitLike()) {
      this.sitForUser();
    } else {
      this.renderer?.sit();
    }
  };

  private lockSitImpl = () => {
    this.sitLock = true;
    this.lockSitPose();
    this.emitState();
  };

  private unlockSitImpl = () => {
    if (!this.sitLock) {
      return;
    }
    this.sitLock = false;
    if (this.restPrompt) {
      this.emitState();
      return;
    }
    this.isHovering = false;
    this.mode = 'auto';
    this.scheduleAutoResume();
    this.emitState();
  };

  private promptRestSitImpl = () => {
    this.sitLock = false;
    this.restPrompt = true;
    this.lockSitPose();
    this.emitState();
  };

  private clearRestPromptImpl = () => {
    if (!this.restPrompt) {
      return;
    }
    this.restPrompt = false;
    if (this.sitLock) {
      this.lockSitPose();
      this.emitState();
      return;
    }
    this.isHovering = false;
    this.mode = 'auto';
    this.scheduleAutoResume();
    this.emitState();
  };

  /** @deprecated 请优先 fire('focus-sit') */
  lockSit = () => {
    this.events.fire('focus-sit');
  };

  /** @deprecated 请优先 endEvent('focus-sit') */
  unlockSit = () => {
    this.events.emit('focus-sit', 'end');
  };

  /** @deprecated 请优先 fire('rest-prompt') */
  promptRestSit = () => {
    this.events.fire('rest-prompt');
  };

  /** @deprecated 请优先 endEvent('rest-prompt') */
  clearRestPrompt = () => {
    this.events.emit('rest-prompt', 'end');
  };

  handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !this.root) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.clearResumeTimer();
    this.mode = 'drag';
    this.phase = 'rest';
    if (!this.idleOnly) {
      this.renderer?.pause();
    }
    this.events.emit('drag', 'start');
    this.emitState();

    this.drag = createDragSession(event.pointerId, event.clientX, event.clientY, this.pos.x, this.pos.y);
    this.root.classList.add('sm-pet--dragging');

    const captureTarget = this.hoverZone ?? this.root;
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    this.attachDragListeners(event.pointerId);
  };

  private handleHoverEnterAnim = () => {
    this.isHovering = true;
    this.mode = 'hover';
    this.events.emit('hover', 'start');
    if (this.idleOnly) {
      this.playIdleLoop();
      this.emitState();
      return;
    }
    if (!this.isSitLike()) {
      this.sitForUser();
    }
    this.emitState();
  };

  private handleHoverLeaveAnim = () => {
    this.isHovering = false;
    this.events.emit('hover', 'end');
    if (this.isSitLocked()) {
      this.lockSitPose();
      this.emitState();
      return;
    }
    if (this.idleOnly) {
      this.mode = 'auto';
      this.playIdleLoop();
      this.emitState();
      return;
    }
    this.scheduleAutoResume();
    this.emitState();
  };

  private attachDragListeners = (pointerId: number) => {
    this.detachDragListeners();
    this.detachDragWindow = attachWindowPointerSession(pointerId, {
      onMove: (clientX, clientY) => this.applyDragMove(clientX, clientY),
      onEnd: endedId => this.finishDrag(endedId),
    });
  };

  private detachDragListeners = () => {
    this.detachDragWindow?.();
    this.detachDragWindow = null;
  };

  private applyDragMove = (clientX: number, clientY: number) => {
    if (!this.drag) {
      return;
    }
    const next = computeDragPosition(this.drag, clientX, clientY);
    if (!next) {
      return;
    }
    this.applyRootPos(next.x, next.y);
    this.events.emit('drag', 'update', { x: next.x, y: next.y });
  };

  private finishDrag = (pointerId: number) => {
    if (!this.drag || this.drag.pointerId !== pointerId) {
      return;
    }

    const drag = this.drag;
    this.drag = null;
    this.detachDragListeners();
    this.root?.classList.remove('sm-pet--dragging');

    const captureTarget = this.hoverZone ?? this.root;
    try {
      captureTarget?.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }

    if (drag.moved && !this.fixedBounds) {
      this.bounds = boundsAround(this.pos.x, this.pos.y);
    }
    this.target = { ...this.pos };
    this.events.emit('drag', 'end', { moved: drag.moved, x: this.pos.x, y: this.pos.y });

    if (!drag.moved) {
      this.events.fire('click', { x: this.pos.x, y: this.pos.y });
      this.events.emit('click', 'end', { x: this.pos.x, y: this.pos.y });
    }

    if (this.isSitLocked()) {
      this.lockSitPose();
      this.emitState();
      return;
    }

    if (this.isHovering) {
      this.mode = 'hover';
      if (this.idleOnly) {
        this.playIdleLoop();
      } else if (!this.isSitLike()) {
        this.sitForUser();
      }
      this.emitState();
      return;
    }

    this.mode = 'auto';
    if (this.idleOnly) {
      this.playIdleLoop();
      this.emitState();
      return;
    }
    this.events.fire('run');
  };

  private playIdleLoop = () => {
    const kind = getPetKind(this.kindId);
    this.phase = 'rest';
    this.renderer?.play(kind.defaultAnim);
  };

  private sitForUser = () => {
    if (this.idleOnly || !this.renderer || this.isSitLike()) {
      return;
    }
    this.clearResumeTimer();
    this.phase = 'rest';
    this.renderer.sitDown();
  };

  private scheduleAutoResume = () => {
    if (this.isSitLocked()) {
      return;
    }
    this.clearResumeTimer();
    this.resumeTimer = window.setTimeout(() => {
      if (this.isDragging() || this.isSitLocked()) {
        return;
      }
      this.resumeFromSit = true;
      this.mode = 'auto';
      this.phase = 'rest';
      this.decisionAt = performance.now() + rand(400, 900);
      this.emitState();
    }, this.resumeDelayMs);
  };

  private beginWalkMotion = (options?: { preserveFacing?: boolean }) => {
    if (this.idleOnly) {
      this.playIdleLoop();
      this.emitState();
      return;
    }

    const preserveFacing = options?.preserveFacing ?? this.resumeFromSit;
    this.resumeFromSit = false;

    const next = pickHorizontalTarget(this.bounds, this.pos.x, this.pos.y, this.facingLeft, false, preserveFacing);
    this.target = { x: next.x, y: next.y };
    this.updateFacing(next.goLeft, true);
    this.phase = 'walk';
    this.renderer?.play('run');
    this.walkLegsLeft = Math.floor(rand(2, 5));
    this.emitState();
  };

  private enterRest = (now: number, holdMs?: number) => {
    this.phase = 'rest';
    this.renderer?.pause();
    this.decisionAt = now + (holdMs ?? rand(2800, 5600));
    this.emitState();
  };

  private tick = (ts: number) => {
    if (this.disposed) {
      return;
    }

    const last = this.lastTs ?? ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    this.lastTs = ts;

    if (
      this.mode === 'auto' &&
      this.phase === 'rest' &&
      !this.idleOnly &&
      !this.isSitLocked() &&
      ts >= this.decisionAt
    ) {
      // 常规事件：按权重随机（run 为主）
      this.events.scheduleRegular();
    }

    this.tickWalk(dt);
    this.renderer?.tick(dt * 1000);
    this.rafId = window.requestAnimationFrame(this.tick);
  };

  private tickWalk = (dt: number) => {
    if (this.phase !== 'walk' || this.mode !== 'auto') {
      return;
    }

    const result = stepWalk(
      {
        pos: this.pos,
        target: this.target,
        facingLeft: this.facingLeft,
        walkLegsLeft: this.walkLegsLeft,
      },
      this.bounds,
      this.walkSpeed,
      dt,
    );

    if (result.kind === 'idle') {
      this.events.fire('idle');
      return;
    }

    this.target = result.target;
    this.walkLegsLeft = result.walkLegsLeft;
    if (result.facingDirty) {
      this.updateFacing(result.facingLeft, true);
    }
    this.applyRootPos(result.pos.x, result.pos.y);
  };

  private handleResize = () => {
    this.bounds = resolveBounds(this.boundsOverride);
    this.clampPositionToBounds();
  };

  private clampPositionToBounds = () => {
    this.applyRootPos(
      clamp(this.pos.x, this.bounds.minX, this.bounds.maxX),
      clamp(this.pos.y, this.bounds.minY, this.bounds.maxY),
    );
  };

  private applyRootPos = (x: number, y: number) => {
    this.pos = { x, y };
    if (this.root) {
      this.root.style.left = `${x}px`;
      this.root.style.top = `${y}px`;
    }
  };

  private updateFacing = (nextLeft: boolean, force = false) => {
    if (!force && nextLeft === this.facingLeft) {
      return;
    }
    this.facingLeft = nextLeft;
    this.renderer?.setFacingLeft(nextLeft);
    this.emitState();
  };

  private clearResumeTimer = () => {
    if (this.resumeTimer) {
      window.clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  };

  private isDragging = () => this.mode === 'drag' || this.drag !== null;

  private isSitLike = () => this.renderer?.isSitLike() ?? false;

  private handleAnimComplete = (ctx: PetEventHookContext) => {
    const signal = ctx.payload as PetAnimSignalPayload | undefined;
    if (signal?.animId === 'sit-down' && this.mode === 'hover') {
      this.renderer?.sit();
    }
  };

  /** 动画帧 → anim:* 频道 */
  private bridgeAnimTopicToEvents = (topic: string, payload: unknown) => {
    const parsed = parseAnimTopic(topic, payload);
    if (!parsed) {
      return;
    }
    this.events.emit('anim', parsed.lifecycle, parsed.signal);
  };

  private emitState = () => {
    this.topics.publish('state', this.getState());
  };
}

export { PetController };
export type { PetControllerOptions, PetMountTarget };
export type { PetControllerState, PetTopic, PetTopicPayload } from './topics';
