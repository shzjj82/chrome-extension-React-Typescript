import { BubbleController } from '../bubble/BubbleController';
import { PetController } from '../core/PetController';
import { createStudyMindUiEvents } from '../events/createStudyMindUiEvents';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BubbleContentResolver } from '../bubble/BubbleController';
import type { PetKindId } from '../core/petKinds';
import type { PetControllerState } from '../core/topics';
import type { PetEventHookContext, PetEventPayloadMap } from '../events';
import type { PetBounds, PetInteractionAction } from '../types';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

type UsePetBehaviorOptions = {
  enabled: boolean;
  boundsProp?: Partial<PetBounds>;
  walkSpeed: number;
  resumeDelayMs: number;
  kind?: PetKindId;
  resolveBubbleActions?: BubbleContentResolver;
  controllerRef?: RefObject<PetController | null>;
};

type UsePetBehaviorResult = {
  rootRef: RefObject<HTMLDivElement | null>;
  hoverZoneRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  menuVisible: boolean;
  facingLeft: boolean;
  bubbleActions: PetInteractionAction[];
  handlers: {
    enterHover: () => void;
    leaveHover: () => void;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    fire: PetController['fire'];
    endEvent: (eventId: string, payload?: unknown) => void;
    updateEvent: (eventId: string, payload?: unknown) => void;
    onPetEvent: (topic: string, hook: (ctx: PetEventHookContext) => void) => (() => void) | undefined;
    onPetEventId: (eventId: string, hook: (ctx: PetEventHookContext) => void) => (() => void) | undefined;
    registerPetEvent: (def: Parameters<PetController['registerPetEvent']>[0]) => void;
    getPosition: () => { x: number; y: number };
    promptRestReminder: (actions: PetInteractionAction[]) => void;
    clearRestReminder: () => void;
    showTemporaryBubble: (actions: PetInteractionAction[], durationMs?: number) => void;
  };
};

const usePetBehavior = ({
  enabled,
  boundsProp,
  walkSpeed,
  resumeDelayMs,
  kind = 'study-buddy',
  resolveBubbleActions,
  controllerRef: externalControllerRef,
}: UsePetBehaviorOptions): UsePetBehaviorResult => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hoverZoneRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<PetController | null>(null);
  const bubbleRef = useRef<BubbleController | null>(null);
  const resolveBubbleActionsRef = useRef<BubbleContentResolver>(resolveBubbleActions ?? (() => []));

  const [menuVisible, setMenuVisible] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [bubbleActions, setBubbleActions] = useState<PetInteractionAction[]>([]);

  useEffect(() => {
    resolveBubbleActionsRef.current = resolveBubbleActions ?? (() => []);
    bubbleRef.current?.setResolveActions(() => resolveBubbleActionsRef.current());
  }, [resolveBubbleActions]);

  useEffect(() => {
    controllerRef.current?.updateOptions({ bounds: boundsProp });
  }, [boundsProp]);

  useLayoutEffect(() => {
    if (!enabled || !rootRef.current || !hostRef.current || !hoverZoneRef.current) {
      return;
    }

    const controller = new PetController({
      walkSpeed,
      resumeDelayMs,
      bounds: boundsProp,
      fixedBounds: Boolean(boundsProp),
      kind,
    });
    // 业务 UI 事件（look-clock / bubble）不进核心默认表
    controller.registerPetEvents(createStudyMindUiEvents());

    const bubble = new BubbleController();
    bubble.attach(controller, () => resolveBubbleActionsRef.current());

    const onPetState = (state: PetControllerState) => {
      setFacingLeft(state.facingLeft);
    };

    const unsubBubble = bubble.subscribe(state => {
      setMenuVisible(state.visible);
      setBubbleActions(state.actions);
    });

    // 气泡触发事件 → BubbleController（业务只需 fire('bubble', payload)）
    const unsubBubbleEvent = controller.onPetEventId('bubble', ctx => {
      if (ctx.lifecycle === 'end') {
        bubble.hide();
        return;
      }
      if (ctx.lifecycle !== 'start' && ctx.lifecycle !== 'update') {
        return;
      }
      const payload = ctx.payload as PetEventPayloadMap['bubble'] | undefined;
      if (!payload?.actions?.length) {
        return;
      }
      if (payload.mode === 'temporary') {
        bubble.showTemporary(payload.actions, payload.durationMs);
      } else {
        bubble.showPinned(payload.actions);
      }
    });

    controller.subscribe('state', onPetState);

    controllerRef.current = controller;
    bubbleRef.current = bubble;
    if (externalControllerRef) {
      externalControllerRef.current = controller;
    }

    controller.mount({
      root: rootRef.current,
      host: hostRef.current,
      hoverZone: hoverZoneRef.current,
    });

    const initial = controller.getState();
    setFacingLeft(initial.facingLeft);
    const bubbleState = bubble.getState();
    setMenuVisible(bubbleState.visible);
    setBubbleActions(bubbleState.actions);

    return () => {
      unsubBubbleEvent();
      unsubBubble();
      controller.unsubscribe('state', onPetState);
      bubble.detach();
      controller.dispose();
      controllerRef.current = null;
      bubbleRef.current = null;
      if (externalControllerRef) {
        externalControllerRef.current = null;
      }
    };
  }, [enabled, walkSpeed, resumeDelayMs, boundsProp, kind, externalControllerRef]);

  const getController = () => controllerRef.current;

  return {
    rootRef,
    hoverZoneRef,
    hostRef,
    menuVisible,
    facingLeft,
    bubbleActions,
    handlers: {
      enterHover: () => getController()?.notifyHoverEnter(),
      leaveHover: () => getController()?.notifyHoverLeave(),
      onPointerDown: event => getController()?.handlePointerDown(event.nativeEvent),
      fire: ((...args: Parameters<PetController['fire']>) =>
        getController()?.fire(...args) ?? false) as PetController['fire'],

      endEvent: (eventId, payload) => getController()?.endEvent(eventId, payload),
      updateEvent: (eventId, payload) => getController()?.updateEvent(eventId, payload),
      onPetEvent: (topic, hook) => getController()?.onPetEvent(topic, hook),
      onPetEventId: (eventId, hook) => getController()?.onPetEventId(eventId, hook),
      registerPetEvent: def => getController()?.registerPetEvent(def),
      getPosition: () => getController()?.getPosition() ?? { x: 0, y: 0 },
      promptRestReminder: actions => {
        getController()?.fire('rest-prompt');
        getController()?.fire('bubble', { actions, mode: 'pinned' } satisfies PetEventPayloadMap['bubble']);
      },
      clearRestReminder: () => {
        getController()?.endEvent('bubble');
        getController()?.endEvent('rest-prompt');
      },
      showTemporaryBubble: (actions, durationMs) => {
        getController()?.fire('bubble', {
          actions,
          mode: 'temporary',
          durationMs,
        } satisfies PetEventPayloadMap['bubble']);
      },
    },
  };
};

export { usePetBehavior };
export type { UsePetBehaviorOptions, UsePetBehaviorResult };
