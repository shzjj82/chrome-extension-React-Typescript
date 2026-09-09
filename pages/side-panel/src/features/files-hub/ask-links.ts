type AskLink = {
  title: string;
  url: string;
};

const searchUrl = (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

const isJunkLinkTitle = (title: string) => {
  const s = title.trim().toLowerCase();
  if (!s || s.length < 2) {
    return true;
  }
  if (/^[-–—_*|=.\s]+$/.test(s)) {
    return true;
  }
  if (['link', 'url', 'http', 'https', 'www', '相关查询', '相关链接', '参考链接'].includes(s)) {
    return true;
  }
  if (/^(link|url)\b/.test(s) && s.length <= 8) {
    return true;
  }
  return false;
};

const isValidHttpUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const buildFallbackLinks = (text: string, sourceUrl: string): AskLink[] => {
  const q = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  const links: AskLink[] = [];
  if (sourceUrl && isValidHttpUrl(sourceUrl)) {
    links.push({ title: '来源页面', url: sourceUrl });
  }
  if (q) {
    links.push({ title: `搜索：${q.slice(0, 24)}${q.length > 24 ? '…' : ''}`, url: searchUrl(q) });
  }
  return links;
};

const splitAnswerSections = (answer: string) => {
  const match = answer.match(
    /^(?:([\s\S]*?)\n)?(?:#{0,3}\s*)?(相关查询|相关链接|参考链接|延伸阅读)[：:]\s*\n([\s\S]*)$/i,
  );
  if (!match) {
    return { body: answer.trim(), linkBlock: '' };
  }
  return {
    body: (match[1] || '').trim(),
    linkBlock: (match[3] || '').trim(),
  };
};

type LinkLineHandler = (ctx: {
  trimmed: string;
  linkBlock: string;
  push: (title: string, url: string) => void;
}) => boolean;

/** 按优先级匹配一行链接；命中则返回 true */
const LINK_LINE_HANDLERS: LinkLineHandler[] = [
  ({ trimmed, push }) => {
    const md = trimmed.match(/^[-*•]\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (!md) {
      return false;
    }
    push(md[1], md[2]);
    return true;
  },
  ({ trimmed, push }) => {
    const pipe = trimmed.match(/^[-*•]?\s*(.+?)\s*[|｜]\s*(.+)$/);
    if (!pipe) {
      return false;
    }
    const left = pipe[1].trim();
    const right = pipe[2].trim();
    if (right.startsWith('http') && isValidHttpUrl(right)) {
      push(left, right);
    } else if (right && !isJunkLinkTitle(right) && right.length >= 2 && right.length <= 60) {
      push(left || right, searchUrl(right));
    }
    return true;
  },
  ({ trimmed, linkBlock, push }) => {
    const plain = trimmed.match(/^[-*•]\s+(.+)$/);
    if (!plain || !linkBlock) {
      return false;
    }
    const item = plain[1].trim();
    if (item.startsWith('http') && isValidHttpUrl(item)) {
      push(item, item);
    } else if (!isJunkLinkTitle(item) && item.length >= 2 && item.length <= 40 && !item.includes('**')) {
      push(item, searchUrl(item));
    }
    return true;
  },
];

const extractLinksFromAnswer = (answer: string, selection: string, sourceUrl: string): AskLink[] => {
  const { linkBlock } = splitAnswerSections(answer);
  const source = linkBlock || answer;
  const links: AskLink[] = [];
  const seen = new Set<string>();

  const push = (title: string, url: string) => {
    const cleanTitle = title.replace(/^[-*•\d.)\s]+/, '').trim();
    if (isJunkLinkTitle(cleanTitle) || !isValidHttpUrl(url) || seen.has(url)) {
      return;
    }
    seen.add(url);
    links.push({ title: cleanTitle, url });
  };

  for (const match of source.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    push(match[1], match[2]);
  }

  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^[-–—_*|=.\s]{2,}$/.test(trimmed)) {
      continue;
    }
    for (const handler of LINK_LINE_HANDLERS) {
      if (handler({ trimmed, linkBlock, push })) {
        break;
      }
    }
  }

  if (links.length === 0) {
    return buildFallbackLinks(selection, sourceUrl);
  }
  return links.slice(0, 6);
};

const displayAnswerBody = (answer: string) => {
  const { body, linkBlock } = splitAnswerSections(answer);
  return (body || (linkBlock ? '' : answer)).trim();
};

/** 流式输出常把表格挤成一行：把表头/分隔行/数据行拆回多行 */
const normalizeMarkdownTables = (text: string) =>
  text
    .replace(/\|\s+(\|(?:\s*:?-+:?\s*)+\|)/g, '|\n$1')
    .replace(/((?:\|\s*:?-+:?\s*)+\|)\s+\|/g, '$1\n|')
    .replace(/(\|[^\n]+?\|)\s+\|(?=[^|\n]*\|)/g, '$1\n|');

export type { AskLink, LinkLineHandler };
export {
  searchUrl,
  isJunkLinkTitle,
  isValidHttpUrl,
  buildFallbackLinks,
  splitAnswerSections,
  extractLinksFromAnswer,
  displayAnswerBody,
  normalizeMarkdownTables,
};
