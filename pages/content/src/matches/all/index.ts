import { extractPageArticle, extractTrackCaptions, extractVisibleCaptions } from './extractors';
import { removeHud } from './paginationDebugHud';
import { createPaginationDetector } from './paginationDetector';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { pomodoroStateStorage } from '@extension/storage';

console.log('[Study Mind] Content script loaded');

/**
 * 红线：仅「专注开始 → 专注结束」窗口内采集。
 * 暂停 / 休息 / idle 一律关闭（含暂停到恢复之间）。
 * 必须同时：storage.phase === 'focus' 且 宠物 focusing === true。
 */
let storageFocusing = false;
let petFocusing = false;
let detectorRunning = false;

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

    void (async () => {
      const state = await pomodoroStateStorage.get();
      if (state.phase !== 'focus') {
        logBrowse('落库前复核失败：phase 已不是 focus，关闭采集', { phase: state.phase });
        storageFocusing = false;
        syncDetector('phase-recheck-fail');
        return;
      }
      if (!canRecord()) {
        logBrowse('落库前复核失败：门禁关闭');
        return;
      }

      logBrowse('准备写入整理素材', {
        trigger: event.trigger,
        url: event.url,
        title: page.title || event.title,
        materialLength: material.length,
        similarity: event.similarity,
        focusStartedAt: state.startedAt,
        focusEndsAt: state.endsAt,
      });

      const result = await sendExtensionMessage(ExtensionMessageType.FOCUS_BROWSE_RECORD, {
        recordedAt: event.at,
        url: event.url,
        title: page.title || event.title || event.url,
        material,
        fingerprint: event.fingerprint,
        trigger: event.trigger,
        similarity: event.similarity,
      });

      if (result.ok) {
        logBrowse('整理素材已写入', { id: result.id, recordedAt: event.at });
      } else {
        logBrowse('整理素材写入被拒绝', { error: result.error });
      }
    })().catch(error => {
      console.warn('[Study Mind][browse] 写入异常', error);
    });
  },
});

const syncDetector = (reason: string) => {
  // 清掉历史调试 HUD（若页面上还留着）
  removeHud();

  const shouldRun = canRecord();
  if (shouldRun && !detectorRunning) {
    detectorRunning = true;
    paginationDetector.start();
    logFocus('专注会话采集已开启', { reason });
    return;
  }
  if (!shouldRun && detectorRunning) {
    detectorRunning = false;
    paginationDetector.stop();
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
