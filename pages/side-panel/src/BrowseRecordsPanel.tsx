import { clearBrowsePages, deleteBrowsePage, listBrowsePagesGroupedByDay } from '@extension/knowledge-base';
import { Button, cn } from '@extension/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BrowseDayGroup, BrowsePageRecord } from '@extension/knowledge-base';

type SiteBucket = {
  key: string;
  label: string;
  /** 含协议，如 http://localhost:3000 */
  origin: string;
  records: BrowsePageRecord[];
  accent: 'rose' | 'amber';
};

type DaySiteGroup = {
  dateKey: string;
  dayLabel: string;
  sites: SiteBucket[];
  total: number;
};

const MAX_SHEETS = 3;

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatDayLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) {
    return dateKey;
  }
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) {
    return `今天 · ${dateKey}`;
  }
  if (sameDay(date, yesterday)) {
    return `昨天 · ${dateKey}`;
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const parseSite = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      key: parsed.origin,
      origin: parsed.origin,
      host: parsed.host,
      path: `${parsed.pathname}${parsed.search}${parsed.hash}` || '/',
    };
  } catch {
    return { key: url || 'unknown', origin: url || '未知来源', host: url || '未知来源', path: '' };
  }
};

const siteLabel = (origin: string, host: string, records: BrowsePageRecord[]) => {
  const titles = records.map(r => (r.title || '').trim()).filter(Boolean);
  if (titles.length === 0) {
    return host || origin;
  }
  const first = titles[0];
  if (titles.every(t => t === first)) {
    return first;
  }
  return host || origin;
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

const groupByDayThenSite = (dayGroups: BrowseDayGroup[]): DaySiteGroup[] =>
  dayGroups.map(day => {
    const map = new Map<string, BrowsePageRecord[]>();
    for (const record of day.records) {
      const { key } = parseSite(record.url);
      const bucket = map.get(key) ?? [];
      bucket.push(record);
      map.set(key, bucket);
    }

    const sites: SiteBucket[] = [...map.entries()]
      .map(([key, records], index) => {
        const parsed = parseSite(records[0]?.url ?? key);
        return {
          key,
          origin: parsed.origin,
          label: siteLabel(parsed.origin, parsed.host, records),
          records: records.sort((a, b) => b.recordedAt - a.recordedAt),
          accent: index % 2 === 0 ? 'rose' : 'amber',
        };
      })
      .sort((a, b) => (b.records[0]?.recordedAt ?? 0) - (a.records[0]?.recordedAt ?? 0));

    return {
      dateKey: day.dateKey,
      dayLabel: formatDayLabel(day.dateKey),
      sites,
      total: day.records.length,
    };
  });

const FolderGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
    />
  </svg>
);

const FileGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm1 7V3.5L19.5 9H15z"
    />
  </svg>
);

/** 按子文件数量叠图纸；命中层固定不移动，避免 transform 导致 hover 闪动 */
const FolderSheets = ({ count }: { count: number }) => {
  const sheets = Math.max(1, Math.min(MAX_SHEETS, count));
  return (
    <div className="folder-card__stage">
      {Array.from({ length: sheets }, (_, index) => {
        const fromBack = sheets - 1 - index;
        return (
          <span key={index} className={`folder-card__hit folder-card__hit--${fromBack}`}>
            <span className={`folder-card__sheet folder-card__sheet--${fromBack}`}>
              <span className="folder-card__skeleton">
                <span className="folder-card__skeleton-line folder-card__skeleton-line--title" />
                <span className="folder-card__skeleton-line folder-card__skeleton-line--lg" />
                <span className="folder-card__skeleton-line folder-card__skeleton-line--md" />
                <span className="folder-card__skeleton-line folder-card__skeleton-line--sm" />
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
};

type BrowseRecordsPanelProps = {
  isLight: boolean;
};

const BrowseRecordsPanel = ({ isLight }: BrowseRecordsPanelProps) => {
  const [groups, setGroups] = useState<BrowseDayGroup[]>([]);
  const [activeSite, setActiveSite] = useState<{ dayKey: string; site: SiteBucket } | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = '整理 · 浏览记录';
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await listBrowsePagesGroupedByDay();
      setGroups(next);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载浏览记录失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const daySiteGroups = useMemo(() => groupByDayThenSite(groups), [groups]);

  // 列表刷新后：若当前打开的站点还在，同步其文件列表；否则退回卡片列表
  useEffect(() => {
    if (!activeSite) {
      return;
    }
    const day = daySiteGroups.find(item => item.dateKey === activeSite.dayKey);
    const site = day?.sites.find(item => item.key === activeSite.site.key) ?? null;
    if (!site) {
      setActiveSite(null);
      setActiveRecordId(null);
      return;
    }
    const sameLength = site.records.length === activeSite.site.records.length;
    const sameIds =
      sameLength && site.records.every((record, index) => record.id === activeSite.site.records[index]?.id);
    if (!sameIds) {
      setActiveSite({ dayKey: activeSite.dayKey, site });
    }
  }, [daySiteGroups, activeSite]);

  const onDelete = async (id: string) => {
    await deleteBrowsePage(id);
    if (activeRecordId === id) {
      setActiveRecordId(null);
    }
    setStatus('已删除');
    await refresh();
  };

  const onClearAll = async () => {
    if (!window.confirm('清空全部浏览记录？')) {
      return;
    }
    await clearBrowsePages();
    setActiveSite(null);
    setActiveRecordId(null);
    setStatus('已清空');
    await refresh();
  };

  const activeRecord = activeSite?.site.records.find(item => item.id === activeRecordId) ?? null;

  return (
    <div className={cn('side-panel sm-shell', !isLight && 'sm-shell--dark')}>
      <header className="sm-shell__header">
        <div className="flex items-center justify-between gap-2">
          <h1 className="sm-shell__brand">整理 · 浏览记录</h1>
          <div className="sm-shell__actions">
            {activeSite ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setActiveSite(null);
                  setActiveRecordId(null);
                }}>
                返回
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void refresh()}>
              刷新
            </Button>
            {!activeSite && groups.length > 0 ? (
              <Button size="sm" variant="destructive" onClick={() => void onClearAll()}>
                清空
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="sm-shell__main">
        {status ? <p className="text-xs text-emerald-700">{status}</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}

        {activeSite ? (
          <section className="sm-shell__card">
            <h2 className="sm-shell__card-title">{activeSite.site.label}</h2>
            <p className="sm-shell__muted">
              {activeSite.site.origin} · {activeSite.site.records.length} 份文件
            </p>
            <div className="folder-file-list">
              {activeSite.site.records.map(record => {
                const open = activeRecordId === record.id;
                return (
                  <article key={record.id} className="folder-file">
                    <button
                      type="button"
                      className="folder-file__row"
                      onClick={() => setActiveRecordId(open ? null : record.id)}>
                      <span className="folder-file__icon">
                        <FileGlyph />
                      </span>
                      <span className="folder-file__body">
                        <span className="folder-file__title">{pageLabel(record)}</span>
                        <span className="folder-file__meta">{formatTime(record.recordedAt)}</span>
                      </span>
                    </button>
                    {open && activeRecord ? (
                      <div className="folder-file__detail">
                        <p className="sm-shell__muted break-all">{activeRecord.url}</p>
                        <textarea
                          className="min-h-28 text-xs"
                          readOnly
                          value={activeRecord.material || '（无正文快照）'}
                        />
                        <div className="sm-shell__actions">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              void navigator.clipboard.writeText(activeRecord.material || activeRecord.url);
                              setStatus('已复制');
                            }}>
                            复制正文
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void onDelete(activeRecord.id)}>
                            删除
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            {daySiteGroups.length === 0 ? <p className="sm-shell__muted">暂无记录</p> : null}
            {daySiteGroups.map(day => (
              <section key={day.dateKey} className="browse-day">
                <h2 className="sm-shell__card-title">
                  {day.dayLabel}
                  <span className="sm-shell__muted"> · {day.total} 条</span>
                </h2>
                <div className="folder-card-grid">
                  {day.sites.map(site => (
                    <article
                      key={`${day.dateKey}::${site.key}`}
                      className={cn('folder-card', `folder-card--${site.accent}`)}>
                      <div className="folder-card__preview" />
                      <FolderSheets count={site.records.length} />
                      <div className="folder-card__body">
                        <div className="folder-card__head">
                          <span className="folder-card__folder-icon">
                            <FolderGlyph />
                          </span>
                          <div className="folder-card__titles">
                            <p className="folder-card__title">{site.label}</p>
                            <p className="folder-card__subtitle">{site.origin}</p>
                          </div>
                        </div>
                        <div className="folder-card__foot">
                          <span className="folder-card__count">
                            <FileGlyph />
                            {site.records.length} Files
                          </span>
                          <button
                            type="button"
                            className="folder-card__open"
                            onClick={() => {
                              setActiveSite({ dayKey: day.dateKey, site });
                              setActiveRecordId(null);
                            }}>
                            查看
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
};

export default BrowseRecordsPanel;
