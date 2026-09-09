import { parseSite } from '@src/lib/site-folder';
import type { OrganizeCardFavoriteItem, OrganizeCardPayload } from './organize-card';
import type { BrowsePageRecord, SelectionFavorite } from '@extension/knowledge-base';

type BrowseItem = {
  key: string;
  record: BrowsePageRecord;
  siteLabel: string;
  siteOrigin: string;
};

type FavoriteItem = {
  key: string;
  favorite: SelectionFavorite;
  siteLabel: string;
};

type LiveMaterial = {
  browseItems: BrowseItem[];
  favoriteItems: FavoriteItem[];
};

/** 整理材料来源：实时选材 vs 只读卡片 */
type OrganizeSource = { kind: 'live'; material: LiveMaterial } | { kind: 'card'; card: OrganizeCardPayload };

const browseKey = (id: string) => `browse:${id}`;
const favoriteKey = (id: string) => `fav:${id}`;

const favoriteFromCard = (item: OrganizeCardFavoriteItem): SelectionFavorite => ({
  id: item.id,
  text: item.text,
  pageTitle: item.pageTitle,
  sourceUrl: item.sourceUrl,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  messages: item.messages ?? [],
  links: item.links ?? [],
});

const browseItemsFromCard = (card: OrganizeCardPayload): BrowseItem[] =>
  card.browse.map(item => ({
    key: browseKey(item.id),
    record: {
      id: item.id,
      dateKey: card.dateKey,
      url: item.url,
      title: item.title,
      recordedAt: item.recordedAt,
      material: item.material ?? '',
      fingerprint: item.id,
      trigger: 'manual' as const,
      similarity: 1,
    } satisfies BrowsePageRecord,
    siteLabel: item.siteLabel,
    siteOrigin: '',
  }));

const favoriteItemsFromCard = (card: OrganizeCardPayload): FavoriteItem[] =>
  card.favorites.map(item => ({
    key: favoriteKey(item.id),
    favorite: favoriteFromCard(item),
    siteLabel: item.siteLabel,
  }));

const resolveBrowseItems = (source: OrganizeSource): BrowseItem[] =>
  source.kind === 'card' ? browseItemsFromCard(source.card) : source.material.browseItems;

const resolveFavoriteItems = (source: OrganizeSource): FavoriteItem[] =>
  source.kind === 'card' ? favoriteItemsFromCard(source.card) : source.material.favoriteItems;

const pageLabel = (record: BrowsePageRecord) => {
  const { path } = parseSite(record.url);
  const segments = path.split('/').filter(Boolean);
  const leaf = segments[segments.length - 1];
  if (leaf) {
    try {
      return decodeURIComponent(leaf.split('?')[0] || leaf);
    } catch {
      return leaf;
    }
  }
  return record.title || path || record.url;
};

export type { BrowseItem, FavoriteItem, LiveMaterial, OrganizeSource };
export { browseKey, favoriteKey, favoriteFromCard, resolveBrowseItems, resolveFavoriteItems, pageLabel };
