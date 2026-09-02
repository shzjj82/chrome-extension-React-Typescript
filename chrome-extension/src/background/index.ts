import 'webextension-polyfill';
import { ExtensionMessageType } from '@extension/shared';
import { learningDraftStorage, pomodoroSettingsStorage, pomodoroStateStorage } from '@extension/storage';
import type { ExtensionRequest, ExtensionMessageTypeValue, ExtensionResponseMap } from '@extension/shared';
import type { PomodoroPhase } from '@extension/storage';

const FOCUS_ALARM = 'study-mind-focus';
const BREAK_ALARM = 'study-mind-break';

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const LEARNING_PANEL_URL = 'side-panel/index.html';

const enableSidePanelForTab = async (tabId: number) => {
  await chrome.sidePanel.setOptions({
    tabId,
    path: LEARNING_PANEL_URL,
    enabled: true,
  });
};

const openLearningWindow = async (tabId: number) => {
  const tab = await chrome.tabs.get(tabId);
  const win = tab.windowId != null ? await chrome.windows.get(tab.windowId) : null;
  const width = 420;
  const height = Math.max(640, Math.min(win?.height ?? 760, 900));
  const left = win?.left != null && win.width != null ? Math.max(0, win.left + win.width - width) : undefined;
  const top = win?.top ?? 0;

  await chrome.windows.create({
    url: chrome.runtime.getURL(LEARNING_PANEL_URL),
    type: 'popup',
    width,
    height,
    left,
    top,
    focused: true,
  });
};

/**
 * Content-script clicks must reach sidePanel.open() in the same message turn
 * (no await before open). setOptions / hydrate can run afterward.
 * Falls back to a popup window only when native open fails.
 */
const openLearningUiForTab = async (tabId: number, sidePanelOpen?: Promise<void>) => {
  let openedNatively = false;

  if (sidePanelOpen) {
    try {
      await sidePanelOpen;
      openedNatively = true;
    } catch {
      openedNatively = false;
    }
  }

  await enableSidePanelForTab(tabId).catch(() => undefined);

  if (!openedNatively) {
    await openLearningWindow(tabId);
  }
};

/** Kick off native side panel open synchronously to preserve user gesture. */
const startNativeSidePanelOpen = (tabId: number) => {
  try {
    return chrome.sidePanel.open({ tabId });
  } catch {
    return undefined;
  }
};

const sendToTab = async <T>(tabId: number, type: ExtensionMessageTypeValue) => {
  try {
    return (await chrome.tabs.sendMessage(tabId, { type })) as T;
  } catch {
    throw new Error('当前页面无法提取内容，请刷新页面后重试，或使用手动导入');
  }
};

const notify = async (title: string, message: string) => {
  await chrome.notifications.create(`study-mind-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon-34.png'),
    title,
    message,
  });
};

const setPomodoroPhase = async (phase: PomodoroPhase, durationMinutes: number, sessionId?: string | null) => {
  const now = Date.now();
  const endsAt = phase === 'idle' ? null : now + durationMinutes * 60_000;

  await chrome.alarms.clear(FOCUS_ALARM);
  await chrome.alarms.clear(BREAK_ALARM);

  if (phase === 'focus') {
    await chrome.alarms.create(FOCUS_ALARM, { when: endsAt! });
  } else if (phase === 'break') {
    await chrome.alarms.create(BREAK_ALARM, { when: endsAt! });
  }

  await pomodoroStateStorage.set(prev => ({
    ...prev,
    phase,
    startedAt: phase === 'idle' ? null : now,
    endsAt,
    activeSessionId: sessionId === undefined ? prev.activeSessionId : sessionId,
  }));
};

const startFocus = async (sessionId?: string | null) => {
  const settings = await pomodoroSettingsStorage.get();
  await setPomodoroPhase('focus', settings.focusMinutes, sessionId ?? null);
};

const startBreak = async () => {
  const settings = await pomodoroSettingsStorage.get();
  const prev = await pomodoroStateStorage.get();
  const focusMs = prev.startedAt ? Date.now() - prev.startedAt : 0;

  await pomodoroStateStorage.set(current => ({
    ...current,
    focusCompletedCount: current.focusCompletedCount + 1,
    accumulatedFocusMs: current.accumulatedFocusMs + Math.max(focusMs, 0),
  }));

  await setPomodoroPhase('break', settings.breakMinutes);
  await notify('专注结束', '休息一下，稍后再继续学习。');
};

const handleAlarm = async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === FOCUS_ALARM) {
    await startBreak();
    return;
  }

  if (alarm.name === BREAK_ALARM) {
    await setPomodoroPhase('idle', 0);
    await notify('休息结束', '可以开始下一轮专注学习了。');
  }
};

const extractFromActiveTab = async (type: ExtensionMessageTypeValue, tabId?: number) => {
  const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
  if (!tab?.id) {
    throw new Error('未找到活动标签页');
  }
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
    throw new Error('当前页面不支持内容提取，请打开普通网页或使用手动导入');
  }

  return sendToTab(tab.id, type);
};

const hydrateDraftFromTab = async (tabId: number) => {
  const tab = await chrome.tabs.get(tabId);
  const extractResult = await extractFromActiveTab(ExtensionMessageType.EXTRACT_PAGE_CONTENT, tabId).catch(() => null);

  if (extractResult && (extractResult as { ok: boolean }).ok) {
    const data = (
      extractResult as {
        data: {
          title: string;
          sourceUrl: string;
          material: string;
          materialSource: 'page' | 'caption' | 'visible_caption';
        };
      }
    ).data;
    await learningDraftStorage.set({
      sessionId: null,
      title: data.title,
      sourceUrl: data.sourceUrl,
      material: data.material,
      materialSource: data.materialSource,
      mode: 'note',
      updatedAt: Date.now(),
    });
    return;
  }

  await learningDraftStorage.set(prev => ({
    ...prev,
    title: tab.title || prev.title || '新的学习会话',
    sourceUrl: tab.url || prev.sourceUrl,
    updatedAt: Date.now(),
  }));
};

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});

chrome.alarms.onAlarm.addListener(alarm => {
  void handleAlarm(alarm);
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest<ExtensionMessageTypeValue>, sender, sendResponse) => {
  const senderTabId = sender.tab?.id;
  const requestedTabId = message.payload && 'tabId' in (message.payload ?? {}) ? message.payload?.tabId : undefined;

  if (message.type === ExtensionMessageType.OPEN_SIDE_PANEL || message.type === ExtensionMessageType.START_LEARNING) {
    const tabId = requestedTabId ?? senderTabId;
    if (tabId == null) {
      sendResponse({ ok: false, error: '未找到可打开侧边栏的标签页' });
      return false;
    }

    // sidePanel.open must start in this turn — before any await — to keep user gesture.
    const sidePanelOpen = startNativeSidePanelOpen(tabId);
    const openPromise = openLearningUiForTab(tabId, sidePanelOpen);

    if (message.type === ExtensionMessageType.OPEN_SIDE_PANEL) {
      void openPromise
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : '打开侧边栏失败',
          });
        });
      return true;
    }

    void (async () => {
      try {
        await openPromise;
        await hydrateDraftFromTab(tabId);
        await startFocus(null);
        sendResponse({ ok: true });
      } catch (error: unknown) {
        // Even if UI open fails, still start focus so the float ball reflects learning state.
        try {
          await hydrateDraftFromTab(tabId);
          await startFocus(null);
        } catch {
          // ignore secondary failures
        }
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : '开始学习失败',
        });
      }
    })();
    return true;
  }

  const handle = async (): Promise<ExtensionResponseMap[ExtensionMessageTypeValue]> => {
    switch (message.type) {
      case ExtensionMessageType.EXTRACT_PAGE_CONTENT:
        return extractFromActiveTab(ExtensionMessageType.EXTRACT_PAGE_CONTENT, message.payload?.tabId ?? senderTabId);

      case ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS:
        return extractFromActiveTab(
          ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS,
          message.payload?.tabId ?? senderTabId,
        );

      case ExtensionMessageType.POMODORO_START:
        await startFocus(message.payload?.sessionId);
        return { ok: true };

      case ExtensionMessageType.POMODORO_START_BREAK: {
        const settings = await pomodoroSettingsStorage.get();
        await setPomodoroPhase('break', settings.breakMinutes);
        return { ok: true };
      }

      case ExtensionMessageType.POMODORO_PAUSE: {
        const state = await pomodoroStateStorage.get();
        if (state.phase === 'focus' && state.startedAt) {
          await pomodoroStateStorage.set(prev => ({
            ...prev,
            accumulatedFocusMs: prev.accumulatedFocusMs + (Date.now() - (prev.startedAt ?? Date.now())),
          }));
        }
        await setPomodoroPhase('idle', 0);
        return { ok: true };
      }

      case ExtensionMessageType.POMODORO_STOP:
        await setPomodoroPhase('idle', 0);
        await pomodoroStateStorage.set(prev => ({
          ...prev,
          activeSessionId: null,
        }));
        return { ok: true };

      case ExtensionMessageType.GET_ACTIVE_TAB_INFO: {
        const tab = await getActiveTab();
        return {
          ok: true,
          data: {
            tabId: tab?.id ?? null,
            title: tab?.title ?? '',
            url: tab?.url ?? '',
          },
        };
      }

      default:
        return { ok: false, error: '未知消息类型' };
    }
  };

  void handle()
    .then(result => sendResponse(result))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '处理失败',
      });
    });

  return true;
});

void pomodoroStateStorage.get();
