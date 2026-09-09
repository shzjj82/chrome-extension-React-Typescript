import type {
  BrowsePageRecord,
  SelectionFavorite,
  SelectionFavoriteLink,
  SelectionFavoriteMessage,
} from '@extension/knowledge-base';

const ORGANIZE_CARD_KIND = 'organize-card' as const;

type OrganizeCardBrowseItem = {
  id: string;
  title: string;
  url: string;
  siteLabel: string;
  recordedAt: number;
  material?: string;
};

type OrganizeCardFavoriteItem = {
  id: string;
  text: string;
  siteLabel: string;
  sourceUrl: string;
  pageTitle: string;
  createdAt: number;
  updatedAt: number;
  messages: SelectionFavoriteMessage[];
  links: SelectionFavoriteLink[];
};

type OrganizeCardPayload = {
  v: 1;
  kind: typeof ORGANIZE_CARD_KIND;
  dateKey: string;
  dayLabel: string;
  browse: OrganizeCardBrowseItem[];
  favorites: OrganizeCardFavoriteItem[];
};

type OrganizeCardSiteInput = {
  label: string;
  browseRecords: BrowsePageRecord[];
  favorites: SelectionFavorite[];
};

const formatOrganizeDayLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) {
    return dateKey;
  }
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
};

const browseTitle = (record: BrowsePageRecord) => {
  try {
    const parsed = new URL(record.url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const leaf = segments[segments.length - 1];
    if (leaf) {
      try {
        return decodeURIComponent(leaf.split('?')[0] || leaf);
      } catch {
        return leaf;
      }
    }
  } catch {
    // ignore
  }
  return record.title || record.url;
};

const buildOrganizeCardFromSite = (dateKey: string, site: OrganizeCardSiteInput): OrganizeCardPayload => ({
  v: 1,
  kind: ORGANIZE_CARD_KIND,
  dateKey,
  dayLabel: formatOrganizeDayLabel(dateKey),
  browse: site.browseRecords.map(record => ({
    id: record.id,
    title: browseTitle(record),
    url: record.url,
    siteLabel: site.label,
    recordedAt: record.recordedAt,
    material: record.material?.trim() || undefined,
  })),
  favorites: site.favorites.map(item => ({
    id: item.id,
    text: item.text,
    siteLabel: site.label,
    sourceUrl: item.sourceUrl || '',
    pageTitle: item.pageTitle || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || item.createdAt,
    messages: item.messages ?? [],
    links: item.links ?? [],
  })),
});

const isOrganizeCardPayload = (value: unknown): value is OrganizeCardPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<OrganizeCardPayload>;
  return data.v === 1 && data.kind === ORGANIZE_CARD_KIND && typeof data.dateKey === 'string';
};

const encodeOrganizeCard = (card: OrganizeCardPayload) => JSON.stringify(card);

const parseOrganizeCard = (content: string): OrganizeCardPayload | null => {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }
  try {
    const data: unknown = JSON.parse(trimmed);
    return isOrganizeCardPayload(data) ? data : null;
  } catch {
    return null;
  }
};

const organizeCardCountLabel = (card: OrganizeCardPayload) => {
  const parts: string[] = [];
  if (card.browse.length > 0) {
    parts.push(`${card.browse.length} 份浏览`);
  }
  if (card.favorites.length > 0) {
    parts.push(`${card.favorites.length} 条收藏`);
  }
  return parts.length > 0 ? parts.join(' · ') : '空';
};

const organizeCardPreview = (card: OrganizeCardPayload) =>
  `资料详情 · ${card.dayLabel} · ${organizeCardCountLabel(card)}`;

/** 发给模型时用短摘要，避免把整卡 JSON 塞进上下文 */
const organizeCardLlmText = (card: OrganizeCardPayload) =>
  `【资料详情】${card.dayLabel}，含 ${organizeCardCountLabel(card)}。用户可通过卡片查看明细。`;

export type { OrganizeCardBrowseItem, OrganizeCardFavoriteItem, OrganizeCardPayload, OrganizeCardSiteInput };
export {
  ORGANIZE_CARD_KIND,
  buildOrganizeCardFromSite,
  encodeOrganizeCard,
  parseOrganizeCard,
  organizeCardCountLabel,
  organizeCardPreview,
  organizeCardLlmText,
};
