import { extractPageArticle, extractTrackCaptions, extractVisibleCaptions } from './extractors';
import { ExtensionMessageType } from '@extension/shared';

console.log('[Study Mind] Content script loaded');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const respond = (payload: unknown) => {
    sendResponse(payload);
  };

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
