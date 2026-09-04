import 'webextension-polyfill';
import { saveBrowsePage } from '@extension/knowledge-base';
import { ExtensionMessageType } from '@extension/shared';
import {
  focusLogStorage,
  isSkippableUrl,
  learningDraftStorage,
  pomodoroSettingsStorage,
  pomodoroStateStorage,
} from '@extension/storage';
import type {
  ExtensionRequest,
  ExtensionMessageTypeValue,
  ExtensionResponseMap,
  SidePanelView,
} from '@extension/shared';
import type { PomodoroPhase } from '@extension/storage';

const FOCUS_ALARM = 'study-mind-focus';
const BREAK_ALARM = 'study-mind-break';

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const panelPath = (view?: SidePanelView) =>
  view === 'browse' ? 'side-panel/index.html?view=browse' : 'side-panel/index.html';

const enableSidePanelForTab = async (tabId: number, view?: SidePanelView) => {
  await chrome.sidePanel.setOptions({
    tabId,
    path: panelPath(view),
    enabled: true,
  });
};

const openLearningWindow = async (tabId: number, view?: SidePanelView) => {
  const tab = await chrome.tabs.get(tabId);
  const win = tab.windowId != null ? await chrome.windows.get(tab.windowId) : null;
  const width = 420;
  const height = Math.max(640, Math.min(win?.height ?? 760, 900));
  const left = win?.left != null && win.width != null ? Math.max(0, win.left + win.width - width) : undefined;
  const top = win?.top ?? 0;

  await chrome.windows.create({
    url: chrome.runtime.getURL(panelPath(view)),
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
 * (no await before open). setOptions is fired without await, then open.
 * Falls back to a popup window only when native open fails.
 */
const openLearningUiForTab = async (tabId: number, sidePanelOpen?: Promise<void>, view?: SidePanelView) => {
  let openedNatively = false;

  if (sidePanelOpen) {
    try {
      await sidePanelOpen;
      openedNatively = true;
    } catch {
      openedNatively = false;
    }
  }

  await enableSidePanelForTab(tabId, view).catch(() => undefined);

  if (!openedNatively) {
    await openLearningWindow(tabId, view);
  }
};

/** Kick off path + native side panel open synchronously to preserve user gesture. */
const startNativeSidePanelOpen = (tabId: number, view?: SidePanelView) => {
  try {
    void chrome.sidePanel.setOptions({
      tabId,
      path: panelPath(view),
      enabled: true,
    });
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

const getMinCountedMs = async () => {
  const settings = await pomodoroSettingsStorage.get();
  return Math.max(1, settings.focusMinutes) * 60_000;
};

const recordActiveTabBrowse = async () => {
  const tab = await getActiveTab();
  if (!tab?.url || isSkippableUrl(tab.url)) {
    return;
  }
  await focusLogStorage.recordBrowse({
    url: tab.url,
    title: tab.title || tab.url,
    visitedAt: Date.now(),
  });
};

const hydrateOrganizeDraftFromBrowse = async (browse: Array<{ url: string; title: string }>, durationMs: number) => {
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  const lines = browse.map(item => `- ${item.title || item.url}\n  ${item.url}`);
  const material =
    lines.length > 0
      ? `本次专注约 ${minutes} 分钟，浏览过：\n${lines.join('\n')}`
      : `本次专注约 ${minutes} 分钟（暂无浏览记录）。`;

  await learningDraftStorage.set(prev => ({
    ...prev,
    sessionId: null,
    title: prev.title || `专注整理 · ${minutes} 分钟`,
    material,
    materialSource: 'page',
    mode: 'note',
    updatedAt: Date.now(),
  }));
};

const setPomodoroPhase = async (
  phase: PomodoroPhase,
  durationMinutes: number,
  options?: { sessionId?: string | null; breakReason?: 'completed' | 'manual' | null },
) => {
  const now = Date.now();
  const endsAt = phase === 'idle' ? null : now + durationMinutes * 60_000;
  const sessionId = options?.sessionId;

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
    breakReason: phase === 'break' ? (options?.breakReason ?? null) : null,
  }));
};

const startFocus = async (sessionId?: string | null) => {
  const settings = await pomodoroSettingsStorage.get();
  await setPomodoroPhase('focus', settings.focusMinutes, { sessionId: sessionId ?? null });
  await focusLogStorage.beginActive();
  await recordActiveTabBrowse();
  const state = await pomodoroStateStorage.get();
  console.log('[Study Mind][focus] 专注开始', {
    at: new Date().toISOString(),
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    focusMinutes: settings.focusMinutes,
    sessionId: state.activeSessionId,
  });
};

/**
 * 结束当前专注并写入日志。
 * 仅达到门槛（默认 40 分钟）才计入每日统计。
 */
const finalizeFocusSession = async (options: { promptOrganizeIfShort?: boolean }) => {
  const before = await pomodoroStateStorage.get();
  const minCountedMs = await getMinCountedMs();
  const result = await focusLogStorage.finalizeActive({
    minCountedMs,
    promptOrganizeIfShort: options.promptOrganizeIfShort,
  });

  if (result?.counted) {
    await pomodoroStateStorage.set(current => ({
      ...current,
      focusCompletedCount: current.focusCompletedCount + 1,
      accumulatedFocusMs: current.accumulatedFocusMs + result.session.durationMs,
    }));
  }

  console.log('[Study Mind][focus] 专注段结束（finalize）', {
    at: new Date().toISOString(),
    startedAt: before.startedAt,
    durationMs: result?.session.durationMs ?? null,
    counted: result?.counted ?? false,
    promptOrganize: options.promptOrganizeIfShort,
  });

  return result;
};

/** @param reason completed=专注时长到点；manual=用户暂停休息 */
const startBreak = async (reason: 'completed' | 'manual') => {
  const settings = await pomodoroSettingsStorage.get();
  console.log('[Study Mind][focus] 进入休息（专注中断）', {
    at: new Date().toISOString(),
    reason,
    breakMinutes: settings.breakMinutes,
  });
  await finalizeFocusSession({ promptOrganizeIfShort: false });
  await setPomodoroPhase('break', settings.breakMinutes, { breakReason: reason });
  if (reason === 'completed') {
    await notify('该休息啦', '已经专注很久了，起来走动一下，我在这儿陪你。');
  }
};

const stopFocus = async () => {
  console.log('[Study Mind][focus] 结束专注 → idle', { at: new Date().toISOString() });
  await finalizeFocusSession({ promptOrganizeIfShort: true });
  await setPomodoroPhase('idle', 0);
  await pomodoroStateStorage.set(prev => ({
    ...prev,
    activeSessionId: null,
  }));
};

const handleAlarm = async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === FOCUS_ALARM) {
    await startBreak('completed');
    return;
  }

  if (alarm.name === BREAK_ALARM) {
    await setPomodoroPhase('idle', 0);
    await notify('缓过来了吗', '准备好的话，可以再开始专注。');
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

  return sendToTab<ExtensionResponseMap[typeof type]>(tab.id, type);
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

/** 专注期间记录浏览 */
chrome.tabs.onActivated.addListener(() => {
  void (async () => {
    const state = await pomodoroStateStorage.get();
    if (state.phase !== 'focus') {
      return;
    }
    await recordActiveTabBrowse();
  })();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) {
    return;
  }
  void (async () => {
    const state = await pomodoroStateStorage.get();
    if (state.phase !== 'focus' || !tab.active || !tab.url) {
      return;
    }
    if (isSkippableUrl(tab.url)) {
      return;
    }
    await focusLogStorage.recordBrowse({
      url: tab.url,
      title: tab.title || tab.url,
      visitedAt: Date.now(),
    });
  })();
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest<ExtensionMessageTypeValue>, sender, sendResponse) => {
  const senderTabId = sender.tab?.id;
  const payload = (message.payload ?? {}) as Record<string, unknown>;
  const requestedTabId = typeof payload.tabId === 'number' ? payload.tabId : undefined;
  const requestedSessionId =
    payload.sessionId === null || typeof payload.sessionId === 'string'
      ? (payload.sessionId as string | null)
      : undefined;

  if (message.type === ExtensionMessageType.OPEN_SIDE_PANEL || message.type === ExtensionMessageType.START_LEARNING) {
    const tabId = requestedTabId ?? senderTabId;
    if (tabId == null) {
      sendResponse({ ok: false, error: '未找到可打开侧边栏的标签页' });
      return false;
    }

    const view = payload.view === 'browse' ? 'browse' : payload.view === 'study' ? 'study' : undefined;

    // sidePanel.open must start in this turn — before any await — to keep user gesture.
    const sidePanelOpen = startNativeSidePanelOpen(
      tabId,
      message.type === ExtensionMessageType.OPEN_SIDE_PANEL ? (view ?? 'browse') : undefined,
    );
    const openPromise = openLearningUiForTab(
      tabId,
      sidePanelOpen,
      message.type === ExtensionMessageType.OPEN_SIDE_PANEL ? (view ?? 'browse') : undefined,
    );

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

    // START_LEARNING：开侧栏整理 + 开始专注（popup 等入口仍用）
    void (async () => {
      try {
        await openPromise;
        await hydrateDraftFromTab(tabId);
        await startFocus(null);
        sendResponse({ ok: true });
      } catch (error: unknown) {
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

  if (message.type === ExtensionMessageType.FOCUS_ORGANIZE_ACCEPT) {
    const tabId = requestedTabId ?? senderTabId;
    if (tabId == null) {
      sendResponse({ ok: false, error: '未找到可打开侧边栏的标签页' });
      return false;
    }

    const sidePanelOpen = startNativeSidePanelOpen(tabId, 'browse');
    const openPromise = openLearningUiForTab(tabId, sidePanelOpen, 'browse');

    void (async () => {
      try {
        const log = await focusLogStorage.get();
        const pending = log.pendingOrganizeAsk;
        if (pending) {
          await hydrateOrganizeDraftFromBrowse(pending.browse, pending.durationMs);
          await focusLogStorage.clearPendingOrganizeAsk();
        }
        await openPromise;
        sendResponse({ ok: true });
      } catch (error: unknown) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : '打开整理失败',
        });
      }
    })();
    return true;
  }

  const handle = async (): Promise<ExtensionResponseMap[ExtensionMessageTypeValue]> => {
    switch (message.type) {
      case ExtensionMessageType.EXTRACT_PAGE_CONTENT:
        return (await extractFromActiveTab(
          ExtensionMessageType.EXTRACT_PAGE_CONTENT,
          requestedTabId ?? senderTabId,
        )) as ExtensionResponseMap[typeof ExtensionMessageType.EXTRACT_PAGE_CONTENT];

      case ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS:
        return (await extractFromActiveTab(
          ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS,
          requestedTabId ?? senderTabId,
        )) as ExtensionResponseMap[typeof ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS];

      case ExtensionMessageType.POMODORO_START:
        await startFocus(requestedSessionId);
        return { ok: true };

      case ExtensionMessageType.POMODORO_START_BREAK: {
        const state = await pomodoroStateStorage.get();
        if (state.phase === 'focus') {
          await startBreak('manual');
        } else {
          const settings = await pomodoroSettingsStorage.get();
          await setPomodoroPhase('break', settings.breakMinutes, { breakReason: 'manual' });
        }
        return { ok: true };
      }

      case ExtensionMessageType.POMODORO_PAUSE: {
        const state = await pomodoroStateStorage.get();
        console.log('[Study Mind][focus] 暂停专注', {
          at: new Date().toISOString(),
          phaseBefore: state.phase,
        });
        if (state.phase === 'focus') {
          await finalizeFocusSession({ promptOrganizeIfShort: false });
        }
        await setPomodoroPhase('idle', 0);
        return { ok: true };
      }

      case ExtensionMessageType.POMODORO_STOP:
        await stopFocus();
        return { ok: true };

      case ExtensionMessageType.FOCUS_ORGANIZE_DISMISS:
        await focusLogStorage.clearPendingOrganizeAsk();
        return { ok: true };

      case ExtensionMessageType.FOCUS_GATE: {
        const focusing = payload.focusing === true;
        console.log('[Study Mind][focus] 收到宠物门禁', {
          at: new Date().toISOString(),
          focusing,
          tabId: senderTabId,
        });
        if (senderTabId != null) {
          await chrome.tabs
            .sendMessage(senderTabId, {
              type: ExtensionMessageType.FOCUS_GATE,
              payload: { focusing },
            })
            .catch(() => undefined);
        }
        return { ok: true };
      }

      case ExtensionMessageType.FOCUS_BROWSE_RECORD: {
        // 红线：整理「文件」仅专注会话可写入；暂停/休息/idle 一律拒绝
        const focusState = await pomodoroStateStorage.get();
        if (focusState.phase !== 'focus') {
          console.log('[Study Mind][browse] 拒绝写入：非专注', {
            at: new Date().toISOString(),
            phase: focusState.phase,
          });
          return { ok: false, error: '非专注模式禁止记录浏览数据' };
        }
        const browsePayload = payload as {
          recordedAt?: number;
          url?: string;
          title?: string;
          material?: string;
          fingerprint?: string;
          trigger?: 'route' | 'pager-click' | 'content-change' | 'manual' | 'focus-enter';
          similarity?: number;
        };
        if (!browsePayload.url || !browsePayload.fingerprint) {
          return { ok: false, error: '浏览记录缺少 url 或 fingerprint' };
        }
        const material = (browsePayload.material || '').trim();
        if (!material) {
          console.log('[Study Mind][browse] 跳过空正文', { url: browsePayload.url });
          return { ok: false, error: '浏览记录正文为空，已跳过' };
        }
        const saved = await saveBrowsePage({
          recordedAt: browsePayload.recordedAt ?? Date.now(),
          url: browsePayload.url,
          title: browsePayload.title || browsePayload.url,
          material,
          fingerprint: browsePayload.fingerprint,
          trigger: browsePayload.trigger || 'content-change',
          similarity: typeof browsePayload.similarity === 'number' ? browsePayload.similarity : 0,
        });
        console.log('[Study Mind][browse] 整理素材已落库', {
          at: new Date().toISOString(),
          id: saved.id,
          recordedAt: saved.recordedAt,
          dateKey: saved.dateKey,
          url: saved.url,
          title: saved.title,
          materialLength: saved.material.length,
          trigger: saved.trigger,
          focusStartedAt: focusState.startedAt,
          focusEndsAt: focusState.endsAt,
        });
        return { ok: true, id: saved.id };
      }

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
void focusLogStorage.get();
