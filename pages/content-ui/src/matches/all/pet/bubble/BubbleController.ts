import type { PetController } from '../core/PetController';
import type { PetInteractionAction } from '../types';

type BubbleContentResolver = () => PetInteractionAction[];

type BubbleControllerState = {
  visible: boolean;
  actions: PetInteractionAction[];
};

type BubbleStateListener = (state: BubbleControllerState) => void;

type PetEventSource = Pick<PetController, 'subscribe' | 'unsubscribe'>;

/**
 * 气泡控制器：订阅 hover/drag，自管显隐；文案由 resolveActions 提供。
 * 与宠物动画解耦，只通过主题总线通信。
 */
class BubbleController {
  private pet: PetEventSource | null = null;
  private resolveActions: BubbleContentResolver = () => [];
  private visible = false;
  private hovering = false;
  private dragging = false;
  private actions: PetInteractionAction[] = [];
  private listeners = new Set<BubbleStateListener>();
  private attached = false;

  attach = (pet: PetEventSource, resolveActions: BubbleContentResolver) => {
    this.detach();
    this.pet = pet;
    this.resolveActions = resolveActions;
    this.attached = true;

    pet.subscribe('hover:enter', this.onHoverEnter);
    pet.subscribe('hover:leave', this.onHoverLeave);
    pet.subscribe('drag:start', this.onDragStart);
    pet.subscribe('drag:end', this.onDragEnd);
  };

  detach = () => {
    if (this.pet && this.attached) {
      this.pet.unsubscribe('hover:enter', this.onHoverEnter);
      this.pet.unsubscribe('hover:leave', this.onHoverLeave);
      this.pet.unsubscribe('drag:start', this.onDragStart);
      this.pet.unsubscribe('drag:end', this.onDragEnd);
    }
    this.pet = null;
    this.attached = false;
    this.visible = false;
    this.hovering = false;
    this.dragging = false;
    this.actions = [];
    this.listeners.clear();
  };

  setResolveActions = (resolveActions: BubbleContentResolver) => {
    this.resolveActions = resolveActions;
    if (this.visible) {
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
    this.setVisible(false);
  };

  private onHoverEnter = () => {
    this.hovering = true;
    if (!this.dragging) {
      this.showWithFreshActions();
    }
  };

  private onHoverLeave = () => {
    this.hovering = false;
    this.setVisible(false);
  };

  private onDragStart = () => {
    this.dragging = true;
    this.setVisible(false);
  };

  private onDragEnd = () => {
    this.dragging = false;
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
