const ExtensionMessageType = {
  START_LEARNING: 'study-mind/start-learning',
  OPEN_SIDE_PANEL: 'study-mind/open-side-panel',
  EXTRACT_PAGE_CONTENT: 'study-mind/extract-page-content',
  EXTRACT_VISIBLE_CAPTIONS: 'study-mind/extract-visible-captions',
  POMODORO_START: 'study-mind/pomodoro-start',
  POMODORO_START_BREAK: 'study-mind/pomodoro-start-break',
  POMODORO_PAUSE: 'study-mind/pomodoro-pause',
  POMODORO_STOP: 'study-mind/pomodoro-stop',
  GET_ACTIVE_TAB_INFO: 'study-mind/get-active-tab-info',
} as const;

type ExtensionMessageTypeValue = (typeof ExtensionMessageType)[keyof typeof ExtensionMessageType];

type ExtractedMaterialPayload = {
  title: string;
  sourceUrl: string;
  material: string;
  materialSource: 'page' | 'caption' | 'visible_caption';
};

type ActiveTabInfoPayload = {
  tabId: number | null;
  title: string;
  url: string;
};

type ExtensionRequestMap = {
  [ExtensionMessageType.START_LEARNING]: { tabId?: number };
  [ExtensionMessageType.OPEN_SIDE_PANEL]: { tabId?: number };
  [ExtensionMessageType.EXTRACT_PAGE_CONTENT]: { tabId?: number };
  [ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS]: { tabId?: number };
  [ExtensionMessageType.POMODORO_START]: { sessionId?: string | null };
  [ExtensionMessageType.POMODORO_START_BREAK]: undefined;
  [ExtensionMessageType.POMODORO_PAUSE]: undefined;
  [ExtensionMessageType.POMODORO_STOP]: undefined;
  [ExtensionMessageType.GET_ACTIVE_TAB_INFO]: undefined;
};

type ExtensionResponseMap = {
  [ExtensionMessageType.START_LEARNING]: { ok: true } | { ok: false; error: string };
  [ExtensionMessageType.OPEN_SIDE_PANEL]: { ok: true } | { ok: false; error: string };
  [ExtensionMessageType.EXTRACT_PAGE_CONTENT]:
    | { ok: true; data: ExtractedMaterialPayload }
    | { ok: false; error: string };
  [ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS]:
    | { ok: true; data: ExtractedMaterialPayload }
    | { ok: false; error: string };
  [ExtensionMessageType.POMODORO_START]: { ok: true } | { ok: false; error: string };
  [ExtensionMessageType.POMODORO_START_BREAK]: { ok: true } | { ok: false; error: string };
  [ExtensionMessageType.POMODORO_PAUSE]: { ok: true } | { ok: false; error: string };
  [ExtensionMessageType.POMODORO_STOP]: { ok: true } | { ok: false; error: string };
  [ExtensionMessageType.GET_ACTIVE_TAB_INFO]: { ok: true; data: ActiveTabInfoPayload } | { ok: false; error: string };
};

type ExtensionRequest<T extends ExtensionMessageTypeValue> = {
  type: T;
  payload?: ExtensionRequestMap[T];
};

const sendExtensionMessage = async <T extends ExtensionMessageTypeValue>(
  type: T,
  payload?: ExtensionRequestMap[T],
): Promise<ExtensionResponseMap[T]> =>
  chrome.runtime.sendMessage({ type, payload }) as Promise<ExtensionResponseMap[T]>;

export type {
  ExtensionMessageTypeValue,
  ExtractedMaterialPayload,
  ActiveTabInfoPayload,
  ExtensionRequestMap,
  ExtensionResponseMap,
  ExtensionRequest,
};
export { ExtensionMessageType, sendExtensionMessage };
