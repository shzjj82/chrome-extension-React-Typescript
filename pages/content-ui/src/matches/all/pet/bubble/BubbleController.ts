import type { PetController } from '../core/PetController';
import type { PetInteractionAction } from '../types';

type BubbleContentResolver = () => PetInteractionAction[];

type BubbleControllerState = {
  visible: boolean;
  actions: PetInteractionAction[];
};

type BubbleStateListener = (state: BubbleControllerState) => void;

/** 气泡只依赖统一事件钩子，不再依赖旧 Topic */
type PetEventSource = Pick<PetController, 'onPetEvent'>;

/**
 * 气泡控制器：订阅 hover/drag 反馈事件，自管显隐。
 */
class BubbleController {
  private pet: PetEventSource | null = null;
  private resolveActions: BubbleContentResolver = () => [];
  private visible = false;
  private hovering = false;
  private dragging = false;
  private pinned = false;
  private actions: PetInteractionAction[] = [];
  private listeners = new Set<BubbleStateListener>();
  private attached = false;
  private tempHideTimer: number | null = null;
  private unsubs: Array<() => void> = [];

  attach = (pet: PetEventSource, resolveActions: BubbleContentResolver) => {
    this.detach();
    this.pet = pet;
    this.resolveActions = resolveActions;
    this.attached = true;

    this.unsubs = [
      pet.onPetEvent('hover:start', this.onHoverEnter),
      pet.onPetEvent('hover:end', this.onHoverLeave),
      pet.onPetEvent('drag:start', this.onDragStart),
      pet.onPetEvent('drag:end', this.onDragEnd),
    ];
  };

  detach = () => {
    this.unsubs.forEach(unsub => unsub());
    this.unsubs = [];
    this.pet = null;
    this.attached = false;
    this.visible = false;
    this.hovering = false;
    this.dragging = false;
    this.pinned = false;
    this.actions = [];
    this.clearTempHideTimer();
    this.listeners.clear();
  };

  setResolveActions = (resolveActions: BubbleContentResolver) => {
    this.resolveActions = resolveActions;
    // 钉住气泡（休息提醒等）用独立内容，勿被 hover resolver 覆盖，否则会留下 pinned=true 却显示「专注/休息」
    if (this.visible && !this.pinned) {
      this.refreshActions();
    }
  };

  getState = (): BubbleControllerState => ({
    visible: this.visible,
    actions: this.actions,
  });

  subscribe = (listener: BubbleStateListener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  hide = () => {
    this.clearTempHideTimer();
    this.pinned = false;
    this.setVisible(false);
  };

  showPinned = (actions: PetInteractionAction[]) => {
    this.clearTempHideTimer();
    this.pinned = true;
    this.actions = this.wrapActions(actions);
    this.visible = this.actions.length > 0;
    this.emit();
  };

  showTemporary = (actions: PetInteractionAction[], durationMs = 4200) => {
    this.showPinned(actions);
    this.tempHideTimer = window.setTimeout(() => {
      this.tempHideTimer = null;
      if (this.hovering) {
        this.pinned = false;
        this.showWithFreshActions();
        return;
      }
      this.hide();
    }, durationMs);
  };

  private clearTempHideTimer = () => {
    if (this.tempHideTimer) {
      window.clearTimeout(this.tempHideTimer);
      this.tempHideTimer = null;
    }
  };

  private onHoverEnter = () => {
    this.hovering = true;
    if (!this.dragging && !this.pinned) {
      this.showWithFreshActions();
    }
  };

  private onHoverLeave = () => {
    this.hovering = false;
    if (!this.pinned) {
      this.setVisible(false);
    }
  };

  private onDragStart = () => {
    this.dragging = true;
    if (!this.pinned) {
      this.setVisible(false);
    }
  };

  private onDragEnd = () => {
    this.dragging = false;
    if (this.pinned) {
      return;
    }
    if (this.hovering) {
      this.showWithFreshActions();
    }
  };

  private showWithFreshActions = () => {
    this.actions = this.wrapActions(this.resolveActions());
    this.visible = this.actions.length > 0;
    this.emit();
  };

  private refreshActions = () => {
    this.actions = this.wrapActions(this.resolveActions());
    if (this.actions.length === 0) {
      this.visible = false;
    }
    this.emit();
  };

  private wrapActions = (actions: PetInteractionAction[]): PetInteractionAction[] =>
    actions.map(action => ({
      ...action,
      onSelect: () => {
        this.hide();
        action.onSelect();
      },
      onSecondarySelect: action.onSecondarySelect
        ? () => {
            this.hide();
            action.onSecondarySelect?.();
          }
        : undefined,
    }));

  private setVisible = (visible: boolean) => {
    if (this.visible === visible) {
      return;
    }
    this.visible = visible;
    this.emit();
  };

  private emit = () => {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  };
}

export { BubbleController };
export type { BubbleContentResolver, BubbleControllerState, BubbleStateListener };
