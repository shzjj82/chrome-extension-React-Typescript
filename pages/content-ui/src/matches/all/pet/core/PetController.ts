import { getPetKind } from './petKinds';
import { PetTopicBus } from './PetTopicBus';
import { PetSpriteRenderer } from '../animation/PetSpriteRenderer';
import { faceTowardsTarget, pickHorizontalTarget } from '../behavior/wander';
import { ARRIVE_EPS, DRAG_THRESHOLD, DRAG_VIEW_MARGIN, VIEW_SIZE } from '../constants';
import { boundsAround, clamp, rand, resolveBounds } from '../utils/bounds';
import type { PetKindId } from './petKinds';
import type { PetControllerState, PetTopic, PetTopicPayload } from './topics';
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

type DragSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

/**
 * 桌面宠物行为控制器：仅负责散步、悬停坐下、拖拽与朝向动画。
 * 不管理气泡；hover/drag 通过主题总线对外通知。
 */
class PetController {
  private readonly topics = new PetTopicBus();

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
  }

  getState = (): PetControllerState => ({
    facingLeft: this.facingLeft,
    mode: this.mode,
    phase: this.phase,
  });

  /** 按主题订阅，如 `run:start`、`hover:enter`、`idle:start`、`animation` */
  subscribe = <T extends PetTopic>(topic: T, listener: (payload: PetTopicPayload[T]) => void) => {
    this.topics.subscribe(topic, listener);
  };

  /** 解除订阅，须传入与 subscribe 相同的 listener 引用 */
  unsubscribe = <T extends PetTopic>(topic: T, listener: (payload: PetTopicPayload[T]) => void) => {
    this.topics.unsubscribe(topic, listener);
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
    renderer.setDefaultAnim(kind.defaultAnim);
    renderer.bindPublish((topic, payload) => this.topics.publish(topic, payload));
    this.topics.subscribe('sit-down:complete', this.handleSitDownComplete);
    this.topics.subscribe('hover:enter', this.handleHoverEnterAnim);
    this.topics.subscribe('hover:leave', this.handleHoverLeaveAnim);
    renderer.mount(this.host);

    if (this.idleOnly) {
      this.playIdleLoop();
    } else {
      this.beginWalkMotion();
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

    this.topics.unsubscribe('sit-down:complete', this.handleSitDownComplete);
    this.topics.unsubscribe('hover:enter', this.handleHoverEnterAnim);
    this.topics.unsubscribe('hover:leave', this.handleHoverLeaveAnim);
    this.renderer?.destroy();
    this.renderer = null;
    this.topics.clear();
    this.root = null;
    this.host = null;
    this.hoverZone = null;
  };

  /** Hover 热区进入：只发事件；动画由自身订阅处理 */
  notifyHoverEnter = () => {
    if (this.isDragging()) {
      return;
    }
    this.topics.publish('hover:enter', undefined);
  };

  /** Hover 热区离开：只发事件；恢复散步由自身订阅处理 */
  notifyHoverLeave = () => {
    if (this.isDragging()) {
      return;
    }
    this.topics.publish('hover:leave', undefined);
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

  /** 外部请求：保持坐下，直到 unlockSit（不关心业务语义） */
  lockSit = () => {
    this.sitLock = true;
    this.lockSitPose();
    this.emitState();
  };

  unlockSit = () => {
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

  /** 专注结束提醒：坐下并保持，直到 clearRestPrompt */
  promptRestSit = () => {
    this.sitLock = false;
    this.restPrompt = true;
    this.lockSitPose();
    this.emitState();
  };

  clearRestPrompt = () => {
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
    this.topics.publish('drag:start', undefined);
    this.emitState();

    this.drag = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: this.pos.x,
      originY: this.pos.y,
      moved: false,
    };
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

    const onMove = (e: PointerEvent) => {
      if (e.pointerId === pointerId) {
        this.applyDragMove(e.clientX, e.clientY);
      }
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId === pointerId) {
        this.finishDrag(pointerId);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    this.detachDragWindow = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  };

  private detachDragListeners = () => {
    this.detachDragWindow?.();
    this.detachDragWindow = null;
  };

  private applyDragMove = (clientX: number, clientY: number) => {
    if (!this.drag) {
      return;
    }

    const dx = clientX - this.drag.startClientX;
    const dy = clientY - this.drag.startClientY;
    if (!this.drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }

    this.drag.moved = true;
    const maxX = window.innerWidth - DRAG_VIEW_MARGIN - VIEW_SIZE;
    const maxY = window.innerHeight - DRAG_VIEW_MARGIN - VIEW_SIZE;
    const x = clamp(this.drag.originX + dx, DRAG_VIEW_MARGIN, Math.max(DRAG_VIEW_MARGIN, maxX));
    const y = clamp(this.drag.originY + dy, DRAG_VIEW_MARGIN, Math.max(DRAG_VIEW_MARGIN, maxY));
    this.applyRootPos(x, y);
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
    this.topics.publish('drag:end', undefined);

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
    this.beginWalkMotion({ preserveFacing: true });
  };

  private playIdleLoop = () => {
    const kind = getPetKind(this.kindId);
    this.phase = 'rest';
    this.renderer?.play(kind.defaultAnim);
    this.publishIdleStart();
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
    this.publishWalkStart();
    this.emitState();
  };

  private enterRest = (now: number, holdMs?: number) => {
    this.phase = 'rest';
    this.renderer?.pause();
    this.decisionAt = now + (holdMs ?? rand(2800, 5600));
    this.publishIdleStart();
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
      this.beginWalkMotion();
    }

    this.tickWalk(dt);
    this.renderer?.tick(dt * 1000);
    this.rafId = window.requestAnimationFrame(this.tick);
  };

  private tickWalk = (dt: number) => {
    if (this.phase !== 'walk' || this.mode !== 'auto') {
      return;
    }

    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < ARRIVE_EPS) {
      if (this.walkLegsLeft > 0 || Math.random() < 0.7) {
        this.walkLegsLeft = Math.max(0, this.walkLegsLeft - 1);
        const next = pickHorizontalTarget(this.bounds, this.pos.x, this.pos.y, this.facingLeft, true);
        this.target = { x: next.x, y: next.y };
        this.updateFacing(next.goLeft, true);
        return;
      }
      this.enterRest(performance.now());
      return;
    }

    const step = this.walkSpeed * dt;
    const ratio = Math.min(1, step / dist);
    const nextX = clamp(this.pos.x + dx * ratio, this.bounds.minX, this.bounds.maxX);
    const nextY = clamp(this.pos.y + dy * Math.min(1, ratio * 1.8), this.bounds.minY, this.bounds.maxY);

    const hitLeft = nextX <= this.bounds.minX + 0.5;
    const hitRight = nextX >= this.bounds.maxX - 0.5;
    if (hitLeft || hitRight) {
      const next = pickHorizontalTarget(this.bounds, nextX, nextY, this.facingLeft, true);
      this.target = { x: next.x, y: next.y };
      this.updateFacing(next.goLeft, true);
      this.walkLegsLeft = Math.max(this.walkLegsLeft, 1);
    } else {
      const nextFacing = faceTowardsTarget(nextX, this.target.x);
      if (nextFacing !== null) {
        this.updateFacing(nextFacing);
      }
    }

    this.applyRootPos(nextX, nextY);
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
    this.topics.publish('facing:change', { facingLeft: nextLeft });
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

  private handleSitDownComplete = () => {
    if (this.mode === 'hover') {
      this.renderer?.sit();
    }
  };

  private publishIdleStart = () => {
    this.topics.publish('idle:start', { mode: this.mode, phase: this.phase });
  };

  private publishWalkStart = () => {
    this.topics.publish('walk:start', { mode: this.mode, phase: this.phase });
  };

  private emitState = () => {
    this.topics.publish('state', this.getState());
  };
}

export { PetController };
export type { PetControllerOptions, PetMountTarget };
export type { PetControllerState, PetTopic, PetTopicPayload } from './topics';
