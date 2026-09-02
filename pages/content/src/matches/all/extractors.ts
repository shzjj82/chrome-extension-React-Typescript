const VISIBLE_CAPTION_SELECTORS = [
  '.bpx-player-subtitle-text',
  '.bilibili-player-video-subtitle span',
  '.bilibili-player-video-subtitle-item',
  '.subtitle-item',
  '.ytp-caption-segment',
  '.vjs-text-track-display',
  '[class*="subtitle"]',
  '[class*="caption"]',
];

const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim();

const collectUniqueLines = (nodes: Iterable<Element>) => {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const text = cleanText(node.textContent ?? '');
    if (!text || text.length < 2 || seen.has(text)) {
      continue;
    }
    seen.add(text);
    lines.push(text);
  }

  return lines;
};

const extractPageArticle = (): { title: string; material: string } => {
  const title = cleanText(document.title || document.querySelector('h1')?.textContent || '未命名页面');
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const contentRoot = article ?? main ?? document.body;

  const clone = contentRoot.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('script, style, noscript, nav, footer, header, iframe, svg, button, form, aside')
    .forEach(node => node.remove());

  const paragraphs = Array.from(clone.querySelectorAll('p, li, h1, h2, h3, h4, pre, code, blockquote'))
    .map(node => cleanText(node.textContent ?? ''))
    .filter(text => text.length > 0);

  const material =
    paragraphs.length > 0 ? paragraphs.join('\n\n') : cleanText(clone.innerText || clone.textContent || '');

  return {
    title,
    material: material.slice(0, 40000),
  };
};

const extractTrackCaptions = (): string => {
  const tracks = Array.from(document.querySelectorAll('track'));
  const texts = tracks.map(track => cleanText(track.textContent ?? track.getAttribute('label') ?? '')).filter(Boolean);

  if (texts.length > 0) {
    return texts.join('\n');
  }

  const cueNodes = document.querySelectorAll('.vjs-text-track-cue, .text-track');
  return collectUniqueLines(cueNodes).join('\n');
};

const extractVisibleCaptions = (): string => {
  const nodes = VISIBLE_CAPTION_SELECTORS.flatMap(selector => Array.from(document.querySelectorAll(selector)));
  const lines = collectUniqueLines(nodes);
  return lines.join('\n').slice(0, 20000);
};

export { extractPageArticle, extractTrackCaptions, extractVisibleCaptions };
