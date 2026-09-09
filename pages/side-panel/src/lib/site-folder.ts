import { toLocalDateKey } from './dayjs';
import type { BrowsePageRecord, SelectionFavorite } from '@extension/knowledge-base';

const UNCATEGORIZED_KEY = '__uncategorized__';
const UNCATEGORIZED_ORIGIN = '未归类';

type ParsedSite = {
  key: string;
  origin: string;
  host: string;
  path: string;
};

type SiteFolder = {
  key: string;
  origin: string;
  label: string;
  browseRecords: BrowsePageRecord[];
  favorites: SelectionFavorite[];
  accent: 'rose' | 'amber';
};

type FolderItem = { kind: 'browse'; record: BrowsePageRecord } | { kind: 'favorite'; favorite: SelectionFavorite };

const parseSite = (url: string): ParsedSite => {
  try {
    const parsed = new URL(url);
    return {
      key: parsed.origin,
      origin: parsed.origin,
      host: parsed.host,
      path: `${parsed.pathname}${parsed.search}${parsed.hash}` || '/',
    };
  } catch {
    return {
      key: url || UNCATEGORIZED_KEY,
      origin: url || UNCATEGORIZED_ORIGIN,
      host: url || UNCATEGORIZED_ORIGIN,
      path: '',
    };
  }
};

const originFromUrl = (url: string) => {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return { key: UNCATEGORIZED_KEY, origin: UNCATEGORIZED_ORIGIN, host: UNCATEGORIZED_ORIGIN };
  }
  const parsed = parseSite(trimmed);
  return { key: parsed.key, origin: parsed.origin, host: parsed.host };
};

const folderLabel = (origin: string, host: string, titles: string[]) => {
  const cleaned = titles.map(t => t.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return host || origin;
  }
  const first = cleaned[0]!;
  if (cleaned.every(t => t === first)) {
    return first;
  }
  return host || origin;
};

const folderCountLabel = (browseCount: number, favoriteCount: number) => {
  const parts: string[] = [];
  if (browseCount > 0) {
    parts.push(`${browseCount} 份浏览`);
  }
  if (favoriteCount > 0) {
    parts.push(`${favoriteCount} 条收藏`);
  }
  return parts.length > 0 ? parts.join(' · ') : '空';
};

const filterFavoritesByDate = (favorites: SelectionFavorite[], dateKey?: string) => {
  if (!dateKey) {
    return favorites;
  }
  return favorites.filter(item => toLocalDateKey(new Date(item.createdAt)) === dateKey);
};

/** 给浏览站点夹挂上同日同 origin 的收藏 */
const attachFavoritesToBrowseFolders = (
  folders: Array<
    Omit<SiteFolder, 'favorites' | 'accent'> & { accent?: SiteFolder['accent']; records?: BrowsePageRecord[] }
  >,
  favorites: SelectionFavorite[],
  dateKey: string,
): SiteFolder[] => {
  const scoped = filterFavoritesByDate(favorites, dateKey);
  const byOrigin = new Map<string, SelectionFavorite[]>();
  for (const item of scoped) {
    const { key } = originFromUrl(item.sourceUrl);
    if (key === UNCATEGORIZED_KEY) {
      continue;
    }
    const bucket = byOrigin.get(key) ?? [];
    bucket.push(item);
    byOrigin.set(key, bucket);
  }

  return folders.map((folder, index) => {
    const browseRecords = folder.browseRecords ?? folder.records ?? [];
    const favs = (byOrigin.get(folder.key) ?? []).sort(
      (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
    );
    return {
      key: folder.key,
      origin: folder.origin,
      label: folder.label,
      browseRecords,
      favorites: favs,
      accent: folder.accent ?? (index % 2 === 0 ? 'rose' : 'amber'),
    };
  });
};

const folderSheetCount = (folder: SiteFolder) => Math.max(1, folder.browseRecords.length + folder.favorites.length);

export type { ParsedSite, SiteFolder, FolderItem };
export {
  UNCATEGORIZED_KEY,
  UNCATEGORIZED_ORIGIN,
  parseSite,
  originFromUrl,
  folderLabel,
  folderCountLabel,
  filterFavoritesByDate,
  attachFavoritesToBrowseFolders,
  folderSheetCount,
};
