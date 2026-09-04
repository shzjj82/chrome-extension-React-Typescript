import { extractPageArticle, extractTrackCaptions, extractVisibleCaptions } from './extractors';
import { removeHud } from './paginationDebugHud';
import { createPaginationDetector } from './paginationDetector';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { pomodoroStateStorage } from '@extension/storage';

console.log('[Study Mind] Content script loaded');

type BrowseRecordTrigger = 'route' | 'pager-click' | 'content-change' | 'manual' | 'focus-enter';

/**
 * 红线：整理用「文件」仅在专注会话内收集。
 * - 开启：phase === 'focus' 且 宠物 focusing === true
 * - 关闭：暂停 / 休息 / idle（含暂停→恢复空档）
 * - 收集：专注开始落首屏 + 专注中翻页/内容显著变化
 */
let storageFocusing = false;
let petFocusing = false;
let detectorRunning = false;
/** 同一段专注只落一次首屏，避免门禁抖动重复写 */
let capturedEnterForStartedAt: number | null = null;
let focusEnterTimer: number | null = null;

const logFocus = (msg: string, extra?: Record<string, unknown>) => {
  console.log(`[Study Mind][focus] ${msg}`, {
    at: new Date().toISOString(),
    storageFocusing,
    petFocusing,
    detectorRunning,
    ...extra,
  });
};

const logBrowse = (msg: string, extra?: Record<string, unknown>) => {
  console.log(`[Study Mind][browse] ${msg}`, {
    at: new Date().toISOString(),
    ...extra,
  });
};

const canRecord = () => storageFocusing && petFocusing;

const fingerprintText = (text: string): string => {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(text.length / 2000));
  for (let i = 0; i < text.length; i += step) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
};

const persistBrowseSnapshot = async (input: {
  recordedAt: number;
  url: string;
  title: string;
  material: string;
  fingerprint: string;
  trigger: BrowseRecordTrigger;
  similarity: number;
}) => {
  const state = await pomodoroStateStorage.get();
  if (state.phase !== 'focus') {
    logBrowse('落库前复核失败：phase 已不是 focus，关闭采集', { phase: state.phase, trigger: input.trigger });
    storageFocusing = false;
    syncDetector('phase-recheck-fail');
    return;
  }
  if (!canRecord()) {
    logBrowse('落库前复核失败：门禁关闭', { trigger: input.trigger });
    return;
  }

  logBrowse('准备写入整理素材', {
    trigger: input.trigger,
    url: input.url,
    title: input.title,
    materialLength: input.material.length,
    similarity: input.similarity,
    focusStartedAt: state.startedAt,
    focusEndsAt: state.endsAt,
  });

  const result = await sendExtensionMessage(ExtensionMessageType.FOCUS_BROWSE_RECORD, {
    recordedAt: input.recordedAt,
    url: input.url,
    title: input.title,
    material: input.material,
    fingerprint: input.fingerprint,
    trigger: input.trigger,
    similarity: input.similarity,
  });

  if (result.ok) {
    logBrowse('整理素材已写入', { id: result.id, recordedAt: input.recordedAt, trigger: input.trigger });
  } else {
    logBrowse('整理素材写入被拒绝', { error: result.error, trigger: input.trigger });
  }
};

/** 专注刚开启：把当前页也收成一份文件（不依赖翻页） */
const captureFocusEnterPage = () => {
  void (async () => {
    if (!canRecord() || !detectorRunning) {
      return;
    }
    const state = await pomodoroStateStorage.get();
    if (state.phase !== 'focus' || !state.startedAt) {
      return;
    }
    if (capturedEnterForStartedAt === state.startedAt) {
      return;
    }

    const page = extractPageArticle();
    const captions = extractTrackCaptions();
    const material = [page.material, captions].filter(Boolean).join('\n\n').trim() || page.material;
    if (!material.trim()) {
      logBrowse('专注首屏跳过：正文为空');
      return;
    }

    capturedEnterForStartedAt = state.startedAt;
    const fingerprint = fingerprintText(material);

    try {
      await persistBrowseSnapshot({
        recordedAt: Date.now(),
        url: location.href,
        title: page.title || document.title || location.href,
        material,
        fingerprint,
        trigger: 'focus-enter',
        similarity: 1,
      });
    } catch (error) {
      capturedEnterForStartedAt = null;
      console.warn('[Study Mind][browse] 专注首屏写入异常', error);
    }
  })();
};

const scheduleFocusEnterCapture = () => {
  if (focusEnterTimer != null) {
    window.clearTimeout(focusEnterTimer);
  }
  // 等正文稍稳定再采，避免 SPA 首屏空壳
  focusEnterTimer = window.setTimeout(() => {
    focusEnterTimer = null;
    captureFocusEnterPage();
  }, 900);
};

const paginationDetector = createPaginationDetector({
  onPagination: event => {
    if (!canRecord() || !detectorRunning) {
      logBrowse('忽略翻页（当前不在专注会话）', {
        trigger: event.trigger,
        url: event.url,
        storageFocusing,
        petFocusing,
        detectorRunning,
      });
      return;
    }

    const page = extractPageArticle();
    const captions = extractTrackCaptions();
    const material = [page.material, captions].filter(Boolean).join('\n\n').trim() || page.material;

    void persistBrowseSnapshot({
      recordedAt: event.at,
      url: event.url,
      title: page.title || event.title || event.url,
      material,
      fingerprint: event.fingerprint,
      trigger: event.trigger,
      similarity: event.similarity,
    }).catch(error => {
      console.warn('[Study Mind][browse] 写入异常', error);
    });
  },
});

const syncDetector = (reason: string) => {
  removeHud();

  const shouldRun = canRecord();
  if (shouldRun && !detectorRunning) {
    detectorRunning = true;
    paginationDetector.start();
    logFocus('专注会话采集已开启', { reason });
    scheduleFocusEnterCapture();
    return;
  }
  if (!shouldRun && detectorRunning) {
    detectorRunning = false;
    paginationDetector.stop();
    if (focusEnterTimer != null) {
      window.clearTimeout(focusEnterTimer);
      focusEnterTimer = null;
    }
    logFocus('专注会话采集已关闭', { reason });
    return;
  }
  logFocus('采集开关无变化', { reason, shouldRun });
};

const applyStoragePhase = (phase: string | undefined, reason: string) => {
  const next = phase === 'focus';
  if (storageFocusing === next) {
    return;
  }
  storageFocusing = next;
  if (next) {
    logFocus('storage 进入 focus（专注开始）', { reason, phase });
  } else {
    logFocus('storage 离开 focus（暂停/休息/结束）', { reason, phase });
    capturedEnterForStartedAt = null;
  }
  syncDetector(reason);
};

const applyPetFocusing = (focusing: boolean, reason: string) => {
  if (petFocusing === focusing) {
    return;
  }
  petFocusing = focusing;
  document.documentElement.dataset.smFocusing = focusing ? '1' : '0';
  logFocus(focusing ? '宠物确认专注中' : '宠物确认非专注（含暂停/休息）', { reason });
  syncDetector(reason);
};

const bootFocusGatedPagination = () => {
  removeHud();
  logFocus('门禁初始化：默认关闭采集，等待专注');

  if (document.documentElement.dataset.smFocusing === '1') {
    petFocusing = true;
  }

  document.addEventListener('study-mind:focus-gate', event => {
    const focusing = Boolean((event as CustomEvent<{ focusing?: boolean }>).detail?.focusing);
    applyPetFocusing(focusing, 'dom-event');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }
    const change = changes['pomodoro-state'];
    if (!change) {
      return;
    }
    const phase = (change.newValue as { phase?: string } | undefined)?.phase;
    applyStoragePhase(phase, 'storage.onChanged');
  });

  void pomodoroStateStorage.get().then(state => {
    logFocus('读取当前番茄状态', {
      phase: state.phase,
      startedAt: state.startedAt,
      endsAt: state.endsAt,
    });
    applyStoragePhase(state.phase, 'boot-get');
  });

  (window as Window & { __SM_PAGINATION__?: unknown }).__SM_PAGINATION__ = {
    getState: () => ({
      detectorRunning,
      storageFocusing,
      petFocusing,
      canRecord: canRecord(),
      capturedEnterForStartedAt,
      detector: paginationDetector.getState(),
    }),
  };
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootFocusGatedPagination, { once: true });
} else {
  bootFocusGatedPagination();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const respond = (payload: unknown) => {
    sendResponse(payload);
  };

  if (message?.type === ExtensionMessageType.FOCUS_GATE) {
    applyPetFocusing(Boolean(message?.payload?.focusing), 'runtime-message');
    respond({ ok: true });
    return false;
  }

  if (message?.type === ExtensionMessageType.EXTRACT_PAGE_CONTENT) {
    try {
      const page = extractPageArticle();
      const captions = extractTrackCaptions();
      const material = [page.material, captions].filter(Boolean).join('\n\n').trim();

      respond({
        ok: true,
        data: {
          title: page.title,
          sourceUrl: location.href,
          material: material || page.material,
          materialSource: captions ? 'caption' : 'page',
        },
      });
    } catch (error) {
      respond({
        ok: false,
        error: error instanceof Error ? error.message : '提取网页正文失败',
      });
    }
    return true;
  }

  if (message?.type === ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS) {
    try {
      const material = extractVisibleCaptions();
      if (!material) {
        respond({
          ok: false,
          error: '未检测到可见字幕，请播放视频后重试，或改用手动粘贴 / 导入字幕文件',
        });
        return true;
      }

      respond({
        ok: true,
        data: {
          title: document.title || '视频字幕素材',
          sourceUrl: location.href,
          material,
          materialSource: 'visible_caption',
        },
      });
    } catch (error) {
      respond({
        ok: false,
        error: error instanceof Error ? error.message : '采集可见字幕失败',
      });
    }
    return true;
  }

  return false;
});
