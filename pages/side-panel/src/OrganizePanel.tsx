import BackIconButton from './BackIconButton';
import { attachFavoritesToBrowseFolders, folderCountLabel, folderLabel, parseSite } from './lib/siteFolder';
import SheetFrame from './SheetFrame';
import { listBrowsePagesGroupedByDay, listSelectionFavorites } from '@extension/knowledge-base';
import { cn } from '@extension/ui';
import { Bookmark, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SiteFolder } from './lib/siteFolder';
import type { BrowsePageRecord, SelectionFavorite } from '@extension/knowledge-base';

type OrganizePayload = {
  dateKey: string;
  siteKeys: string[];
};

type OrganizePanelProps = {
  isLight: boolean;
  dateKey: string;
  siteKeys: string[];
  onBack: () => void;
  /** 独立浏览器标签全页（类似设置） */
  pageMode?: boolean;
};

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

const excerpt = (text: string, max = 96) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max)}…`;
};

const FileGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm1 7V3.5L19.5 9H15z"
    />
  </svg>
);

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

const OrganizePanel = ({ isLight, dateKey, siteKeys, onBack, pageMode = false }: OrganizePanelProps) => {
  const [sites, setSites] = useState<SiteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);
  const [sheetFavorite, setSheetFavorite] = useState<SelectionFavorite | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dayGroups, favorites] = await Promise.all([listBrowsePagesGroupedByDay(), listSelectionFavorites()]);
      const day = dayGroups.find(item => item.dateKey === dateKey);
      const next = buildSitesForDay(dateKey, siteKeys, day?.records ?? [], favorites);
      setSites(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载整理材料失败');
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [dateKey, siteKeys]);

  useEffect(() => {
    if (!dateKey) {
      setLoading(false);
      setSites([]);
      return;
    }
    void load();
  }, [dateKey, load]);

  useEffect(() => {
    document.title = '整理';
  }, []);

  const summary = useMemo(() => {
    const browseTotal = sites.reduce((sum, site) => sum + site.browseRecords.length, 0);
    const favoriteTotal = sites.reduce((sum, site) => sum + site.favorites.length, 0);
    return {
      browseTotal,
      favoriteTotal,
      siteCount: sites.length,
      empty: browseTotal === 0 && favoriteTotal === 0,
    };
  }, [sites]);

  return (
    <div className={cn('organize-panel', pageMode && 'organize-panel--page', !isLight && 'sm-shell--dark')}>
      <header className="organize-panel__header">
        <BackIconButton className="organize-panel__back" onClick={onBack} />
        <div className="organize-panel__titles">
          <h1 className="organize-panel__title">整理</h1>
          <p className="organize-panel__subtitle">
            {formatDayLabel(dateKey)}
            {summary.siteCount > 0
              ? ` · ${summary.siteCount} 站 · ${folderCountLabel(summary.browseTotal, summary.favoriteTotal)}`
              : null}
          </p>
        </div>
        <span className="organize-panel__header-spacer" aria-hidden="true" />
      </header>

      <div className="organize-panel__scroll">
        {loading ? <p className="organize-panel__hint">加载中…</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}

        {!loading && !error && (summary.empty || !dateKey) ? (
          <div className="browse-empty">
            <p className="browse-empty__title">{dateKey ? '这一天没有可整理的内容' : '没有整理材料'}</p>
            <p className="browse-empty__hint">
              {dateKey ? '换个日期，或先去专注留下浏览快照、去提问页收藏' : '请从文件页的专注分区点击「整理」打开'}
            </p>
          </div>
        ) : null}

        {!loading
          ? sites.map(site => (
              <section key={site.key} className="sm-shell__card organize-panel__site">
                <h2 className="sm-shell__card-title">{site.label}</h2>
                <p className="sm-shell__muted">
                  {site.origin} · {folderCountLabel(site.browseRecords.length, site.favorites.length)}
                </p>

                {site.browseRecords.length > 0 ? (
                  <div className="folder-section">
                    <p className="folder-section__title">浏览快照</p>
                    <div className="folder-file-list">
                      {site.browseRecords.map(record => {
                        const open = openRecordId === record.id;
                        return (
                          <article key={record.id} className="folder-file">
                            <button
                              type="button"
                              className="folder-file__row"
                              onClick={() => setOpenRecordId(open ? null : record.id)}>
                              <span className="folder-file__icon">
                                <FileGlyph />
                              </span>
                              <span className="folder-file__body">
                                <span className="folder-file__title">{pageLabel(record)}</span>
                                <span className="folder-file__meta">
                                  {formatTime(record.recordedAt)}
                                  {record.material?.trim() ? ` · ${excerpt(record.material)}` : ' · （无正文快照）'}
                                </span>
                              </span>
                            </button>
                            {open ? (
                              <div className="folder-file__detail">
                                <p className="sm-shell__muted break-all">{record.url}</p>
                                <textarea
                                  className="organize-panel__material"
                                  readOnly
                                  value={record.material?.trim() || '（无正文快照）'}
                                />
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {site.favorites.length > 0 ? (
                  <div className="folder-section">
                    <p className="folder-section__title">提问收藏</p>
                    <div className="folder-file-list">
                      {site.favorites.map(item => (
                        <article key={item.id} className="folder-file folder-file--favorite">
                          <button type="button" className="folder-file__row" onClick={() => setSheetFavorite(item)}>
                            <span className="folder-file__icon folder-file__icon--favorite">
                              <Bookmark size={14} strokeWidth={2.2} />
                            </span>
                            <span className="folder-file__body">
                              <span className="folder-file__title">{item.text}</span>
                              <span className="folder-file__meta">
                                提问收藏 · {formatTime(item.updatedAt || item.createdAt)}
                              </span>
                            </span>
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ))
          : null}
      </div>

      <SheetFrame
        open={Boolean(sheetFavorite)}
        showHeader={false}
        ariaLabel="收藏内容"
        isLight={isLight}
        className="selection-ask__fav-sheet"
        onClose={() => setSheetFavorite(null)}>
        {sheetFavorite ? (
          <div className="selection-ask__fav-sheet-body">
            <section className="selection-ask__card selection-ask__card--source">
              <p className="selection-ask__label">提问收藏</p>
              <p className="selection-ask__quote">{sheetFavorite.text}</p>
              {sheetFavorite.pageTitle || sheetFavorite.sourceUrl ? (
                <div className="selection-ask__meta">
                  {sheetFavorite.pageTitle ? (
                    <p className="selection-ask__meta-title">{sheetFavorite.pageTitle}</p>
                  ) : null}
                  {sheetFavorite.sourceUrl ? (
                    <a
                      className="selection-ask__meta-url"
                      href={sheetFavorite.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={sheetFavorite.sourceUrl}>
                      {sheetFavorite.sourceUrl}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>

            {(sheetFavorite.messages ?? [])
              .filter(msg => !msg.hidden && msg.content.trim())
              .map(msg => (
                <section
                  key={msg.id}
                  className={cn(
                    'selection-ask__card',
                    msg.role === 'user' ? 'selection-ask__card--user' : 'selection-ask__card--answer',
                  )}>
                  <p className="selection-ask__label">{msg.role === 'user' ? '追问' : '解答'}</p>
                  <p className="selection-ask__quote">{msg.content}</p>
                </section>
              ))}

            {(sheetFavorite.links?.length ?? 0) > 0 ? (
              <section className="selection-ask__card">
                <p className="selection-ask__label">相关查询</p>
                <ul className="selection-ask__links">
                  {sheetFavorite.links.map(link => (
                    <li key={`${link.title}-${link.url}`}>
                      <a className="selection-ask__link" href={link.url} target="_blank" rel="noreferrer">
                        <span>{link.title}</span>
                        <ExternalLink size={14} strokeWidth={2} />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetFrame>
    </div>
  );
};

export default OrganizePanel;
export type { OrganizePayload, OrganizePanelProps };
