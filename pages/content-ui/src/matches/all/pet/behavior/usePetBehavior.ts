import { BubbleController } from '../bubble/BubbleController';
import { PetController } from '../core/PetController';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BubbleContentResolver } from '../bubble/BubbleController';
import type { PetControllerState } from '../core/topics';
import type { PetBounds, PetInteractionAction } from '../types';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

type UsePetBehaviorOptions = {
  enabled: boolean;
  boundsProp?: Partial<PetBounds>;
  walkSpeed: number;
  resumeDelayMs: number;
  resolveBubbleActions?: BubbleContentResolver;
  /** 实例创建后写入，便于在外部挂载 hooks */
  controllerRef?: RefObject<PetController | null>;
};

type UsePetBehaviorResult = {
  rootRef: RefObject<HTMLDivElement | null>;
  hoverZoneRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  menuVisible: boolean; // bubble visible（由 BubbleController 驱动）
  facingLeft: boolean;
  bubbleActions: PetInteractionAction[];
  handlers: {
    enterHover: () => void;
    leaveHover: () => void;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
};

const usePetBehavior = ({
  enabled,
  boundsProp,
  walkSpeed,
  resumeDelayMs,
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
    });

    const bubble = new BubbleController();
    bubble.attach(controller, () => resolveBubbleActionsRef.current());

    const onPetState = (state: PetControllerState) => {
      setFacingLeft(state.facingLeft);
    };

    const unsubBubble = bubble.subscribe(state => {
      setMenuVisible(state.visible);
      setBubbleActions(state.actions);
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
  }, [enabled, walkSpeed, resumeDelayMs, boundsProp, externalControllerRef]);

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
    },
  };
};

export { usePetBehavior };
export type { UsePetBehaviorOptions, UsePetBehaviorResult };
