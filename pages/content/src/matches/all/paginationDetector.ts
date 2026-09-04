/**
 * 分页判定（仅专注模式由调用方启动）
 * - 准入：路由变化 / 疑似翻页点击 / 主内容显著替换或大幅追加
 * - 小幅 DOM 噪音只更新基线，不记为换页
 */

type PaginationTrigger = 'route' | 'pager-click' | 'content-change';

type PaginationEvent = {
  at: number;
  trigger: PaginationTrigger;
  url: string;
  title: string;
  /** 主内容正文快照（判定用；落库可由调用方改用更优提取） */
  material: string;
  fingerprint: string;
  prevFingerprint: string;
  similarity: number;
  note: string;
};

type PaginationDetectorOptions = {
  settleMs?: number;
  minIntervalMs?: number;
  /** 内容替换：相似度低于此值才记（默认更严） */
  replaceSimilarity?: number;
  /** 追加加载：新增字符超过此值才记 */
  appendMinChars?: number;
  onPagination?: (event: PaginationEvent) => void;
};

const PAGER_TEXT_RE = /^(下一页|上一页|下页|上页|next|prev|previous|›|»|‹|«|\d+)$/i;
const PAGER_ATTR_RE = /paginat|pager|page[-_]?next|page[-_]?prev|page[-_]?num|pagination/i;

const DEFAULTS = {
  settleMs: 700,
  minIntervalMs: 2500,
  replaceSimilarity: 0.45,
  appendMinChars: 1800,
  /** 高于此相似度的指纹漂移视为噪音，静默对齐基线 */
  noiseAlignSimilarity: 0.82,
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getMainRoot = (): HTMLElement => {
  const el =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.body;
  return el as HTMLElement;
};

const extractMainText = (): string => {
  const root = getMainRoot();
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      'script, style, noscript, nav, footer, header, iframe, svg, button, form, aside, [role="tooltip"], [class*="tooltip"], [class*="popover"], [class*="advert"], [class*="ads"], [id*="ads"]',
    )
    .forEach(node => node.remove());

  const chunks = Array.from(clone.querySelectorAll('p, li, h1, h2, h3, h4, pre, code, blockquote, td, th'))
    .map(node => normalizeText(node.textContent ?? ''))
    .filter(text => text.length > 1);

  const text = chunks.length > 0 ? chunks.join('\n') : normalizeText(clone.innerText || clone.textContent || '');
  return text.slice(0, 60000);
};

const fingerprintText = (text: string): string => {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(text.length / 2000));
  for (let i = 0; i < text.length; i += step) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
};

const textSimilarity = (a: string, b: string): number => {
  if (!a && !b) {
    return 1;
  }
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }

  const shingles = (s: string) => {
    const set = new Set<string>();
    const compact = s.slice(0, 8000);
    for (let i = 0; i < compact.length - 3; i += 2) {
      set.add(compact.slice(i, i + 4));
    }
    return set;
  };

  const sa = shingles(a);
  const sb = shingles(b);
  let inter = 0;
  sa.forEach(x => {
    if (sb.has(x)) {
      inter += 1;
    }
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
};

const isPagerLikeTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }
  const el = target.closest('a, button, [role="button"], [role="link"]');
  if (!el) {
    return false;
  }

  const text = normalizeText(el.textContent ?? '');
  const label = `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`;
  const cls = `${el.className ?? ''} ${el.id ?? ''}`;

  if (PAGER_TEXT_RE.test(text) || PAGER_TEXT_RE.test(normalizeText(label))) {
    return true;
  }
  if (PAGER_ATTR_RE.test(cls) || PAGER_ATTR_RE.test(label)) {
    return true;
  }
  if (/^\d{1,3}$/.test(text) && /page|paginat|pager/i.test(cls + label)) {
    return true;
  }
  return false;
};

const routeKey = () => `${location.pathname}${location.search}${location.hash}`;

const createPaginationDetector = (options: PaginationDetectorOptions = {}) => {
  const settleMs = options.settleMs ?? DEFAULTS.settleMs;
  const minIntervalMs = options.minIntervalMs ?? DEFAULTS.minIntervalMs;
  const replaceSimilarity = options.replaceSimilarity ?? DEFAULTS.replaceSimilarity;
  const appendMinChars = options.appendMinChars ?? DEFAULTS.appendMinChars;
  const onPagination = options.onPagination;

  let lastRoute = routeKey();
  let lastText = '';
  let lastFingerprint = '';
  let lastEmitAt = 0;
  let pendingPagerClick = false;
  let settleTimer: number | null = null;
  let armedTrigger: PaginationTrigger = 'content-change';
  let started = false;

  const emitIfChanged = (trigger: PaginationTrigger, note: string) => {
    const now = Date.now();
    if (now - lastEmitAt < minIntervalMs) {
      return false;
    }

    const nextText = extractMainText();
    const nextFp = fingerprintText(nextText);
    const similarity = textSimilarity(lastText, nextText);
    const replaced = similarity < replaceSimilarity;
    const appended = nextText.length > lastText.length + appendMinChars;

    // 路由 / 翻页点击：放宽一点；纯 DOM 噪音必须显著替换或大幅追加
    const routeForce = trigger === 'route';
    const pagerForce = trigger === 'pager-click' && (replaced || appended || similarity < 0.7);
    const contentForce = trigger === 'content-change' && (replaced || appended);
    const shouldRecord = routeForce || pagerForce || contentForce;

    if (nextFp === lastFingerprint) {
      pendingPagerClick = false;
      return false;
    }

    if (!shouldRecord) {
      // 小幅漂移：对齐基线，避免噪音累积后误判为换页
      if (similarity >= DEFAULTS.noiseAlignSimilarity) {
        lastText = nextText;
        lastFingerprint = nextFp;
      }
      pendingPagerClick = false;
      return false;
    }

    const event: PaginationEvent = {
      at: now,
      trigger,
      url: location.href,
      title: document.title,
      material: nextText,
      fingerprint: nextFp,
      prevFingerprint: lastFingerprint,
      similarity: Number(similarity.toFixed(3)),
      note,
    };

    lastText = nextText;
    lastFingerprint = nextFp;
    lastEmitAt = now;
    pendingPagerClick = false;
    onPagination?.(event);
    return true;
  };

  const scheduleCheck = (trigger: PaginationTrigger, note: string) => {
    armedTrigger = trigger;
    if (settleTimer != null) {
      window.clearTimeout(settleTimer);
    }
    settleTimer = window.setTimeout(() => {
      settleTimer = null;
      emitIfChanged(armedTrigger, note);
    }, settleMs);
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!isPagerLikeTarget(event.target)) {
      return;
    }
    pendingPagerClick = true;
    scheduleCheck('pager-click', '疑似分页控件点击，等待主内容稳定');
  };

  const onRouteMaybeChanged = (reason: string) => {
    const next = routeKey();
    if (next === lastRoute) {
      return;
    }
    lastRoute = next;
    scheduleCheck('route', `路由变化：${reason}`);
  };

  const onHashChange = () => onRouteMaybeChanged('hashchange');
  const onPopState = () => onRouteMaybeChanged('popstate');

  const patchHistory = () => {
    const wrap = (method: 'pushState' | 'replaceState') => {
      const original = history[method].bind(history);
      history[method] = (...args: Parameters<History['pushState']>) => {
        const ret = original(...args);
        onRouteMaybeChanged(method);
        return ret;
      };
      return original;
    };
    return {
      pushState: wrap('pushState'),
      replaceState: wrap('replaceState'),
    };
  };

  let historyOriginals: { pushState: History['pushState']; replaceState: History['replaceState'] } | null = null;

  const mutationObserver = new MutationObserver(mutations => {
    const meaningful = mutations.some(m => {
      if (m.type === 'characterData') {
        return true;
      }
      if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        return true;
      }
      return false;
    });

    if (!meaningful) {
      return;
    }

    if (pendingPagerClick) {
      scheduleCheck('pager-click', '分页点击后主内容 DOM 变化');
      return;
    }

    // 无翻页意图时降频：只在子树结构变化后检查，阈值已抬高
    scheduleCheck('content-change', '主内容区 DOM 变化');
  });

  const start = () => {
    if (started) {
      return;
    }
    started = true;
    lastRoute = routeKey();
    lastText = extractMainText();
    lastFingerprint = fingerprintText(lastText);
    lastEmitAt = 0;

    document.addEventListener('click', onClickCapture, true);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    historyOriginals = patchHistory();

    // 不听 attributes：hover class/style 是主要噪音源
    mutationObserver.observe(getMainRoot(), {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: false,
    });

    console.info('[Study Mind][pagination] detector started', {
      url: location.href,
      fingerprint: lastFingerprint,
      textLength: lastText.length,
    });
  };

  const stop = () => {
    if (!started) {
      return;
    }
    started = false;
    document.removeEventListener('click', onClickCapture, true);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('popstate', onPopState);
    mutationObserver.disconnect();
    if (settleTimer != null) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
    if (historyOriginals) {
      history.pushState = historyOriginals.pushState;
      history.replaceState = historyOriginals.replaceState;
      historyOriginals = null;
    }
  };

  const getState = () => ({
    started,
    url: location.href,
    route: lastRoute,
    fingerprint: lastFingerprint,
    textLength: lastText.length,
    pendingPagerClick,
  });

  return { start, stop, getState, checkNow: () => emitIfChanged('content-change', '手动检查') };
};

export { createPaginationDetector };
export type { PaginationDetectorOptions, PaginationEvent, PaginationTrigger };
