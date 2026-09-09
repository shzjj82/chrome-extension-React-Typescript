import { ORGANIZE_CARD_KIND } from './organize-card';
import { browseKey, favoriteKey, pageLabel } from './organize-source';
import { attachFavoritesToBrowseFolders, folderLabel, parseSite } from '@src/lib/site-folder';
import type { OrganizeCardPayload } from './organize-card';
import type { BrowseItem, FavoriteItem } from './organize-source';
import type { BrowsePageRecord, SelectionFavorite } from '@extension/knowledge-base';
import type { SiteFolder } from '@src/lib/site-folder';

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatDayLabel = (dateKey: string) => {
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

const excerpt = (text: string, max = 96) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max)}…`;
};

const buildSitesForDay = (
  dateKey: string,
  siteKeys: string[],
  dayRecords: BrowsePageRecord[],
  favorites: SelectionFavorite[],
): SiteFolder[] => {
  const map = new Map<string, BrowsePageRecord[]>();
  for (const record of dayRecords) {
    const { key } = parseSite(record.url);
    const bucket = map.get(key) ?? [];
    bucket.push(record);
    map.set(key, bucket);
  }

  const base = [...map.entries()].map(([key, records], index) => {
    const parsed = parseSite(records[0]?.url ?? key);
    return {
      key,
      origin: parsed.origin,
      label: folderLabel(
        parsed.origin,
        parsed.host,
        records.map(r => r.title || ''),
      ),
      browseRecords: records.sort((a, b) => b.recordedAt - a.recordedAt),
      accent: (index % 2 === 0 ? 'rose' : 'amber') as 'rose' | 'amber',
    };
  });

  const attached = attachFavoritesToBrowseFolders(base, favorites, dateKey);
  const byKey = new Map(attached.map(site => [site.key, site]));
  const ordered: SiteFolder[] = [];
  for (const key of siteKeys) {
    const site = byKey.get(key);
    if (site) {
      ordered.push(site);
    }
  }
  return ordered;
};

const flattenGroups = (sites: SiteFolder[]) => {
  const browseItems: BrowseItem[] = [];
  const favoriteItems: FavoriteItem[] = [];
  for (const site of sites) {
    for (const record of site.browseRecords) {
      browseItems.push({
        key: browseKey(record.id),
        record,
        siteLabel: site.label,
        siteOrigin: site.origin,
      });
    }
    for (const favorite of site.favorites) {
      favoriteItems.push({
        key: favoriteKey(favorite.id),
        favorite,
        siteLabel: site.label,
      });
    }
  }
  return { browseItems, favoriteItems };
};

const buildOrganizeCard = (
  dateKey: string,
  browseItems: BrowseItem[],
  favoriteItems: FavoriteItem[],
  selected: Set<string>,
): OrganizeCardPayload => {
  const browse = browseItems
    .filter(item => selected.has(item.key))
    .map(item => ({
      id: item.record.id,
      title: pageLabel(item.record),
      url: item.record.url,
      siteLabel: item.siteLabel,
      recordedAt: item.record.recordedAt,
      material: item.record.material?.trim() || undefined,
    }));

  const favorites = favoriteItems
    .filter(item => selected.has(item.key))
    .map(item => ({
      id: item.favorite.id,
      text: item.favorite.text,
      siteLabel: item.siteLabel,
      sourceUrl: item.favorite.sourceUrl || '',
      pageTitle: item.favorite.pageTitle || '',
      createdAt: item.favorite.createdAt,
      updatedAt: item.favorite.updatedAt || item.favorite.createdAt,
      messages: item.favorite.messages ?? [],
      links: item.favorite.links ?? [],
    }));

  return {
    v: 1,
    kind: ORGANIZE_CARD_KIND,
    dateKey,
    dayLabel: formatDayLabel(dateKey),
    browse,
    favorites,
  };
};

export { formatTime, formatDayLabel, excerpt, buildSitesForDay, flattenGroups, buildOrganizeCard };
