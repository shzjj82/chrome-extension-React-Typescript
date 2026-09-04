import BrowseDayCalendar, { toLocalDateKey } from './BrowseDayCalendar';
import { clearBrowsePages, deleteBrowsePage, listBrowsePagesGroupedByDay } from '@extension/knowledge-base';
import { Button, cn } from '@extension/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedDateKey, setSelectedDateKey] = useState(() => toLocalDateKey(new Date()));
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<string[]>([]);
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

  const recordDateKeys = useMemo(() => new Set(daySiteGroups.map(day => day.dateKey)), [daySiteGroups]);
  const didInitDateRef = useRef(false);

  // 首次有数据时：若当天无记录，落到最近有数据的一天（不打断用户之后选空日期）
  useEffect(() => {
    if (daySiteGroups.length === 0) {
      didInitDateRef.current = false;
      return;
    }
    if (didInitDateRef.current) {
      return;
    }
    didInitDateRef.current = true;
    if (!recordDateKeys.has(selectedDateKey)) {
      setSelectedDateKey(daySiteGroups[0]!.dateKey);
    }
  }, [daySiteGroups, recordDateKeys, selectedDateKey]);

  const selectedDay = useMemo(
    () => daySiteGroups.find(day => day.dateKey === selectedDateKey) ?? null,
    [daySiteGroups, selectedDateKey],
  );

  // 换日后清空勾选；勾选仅保留仍存在的站点
  useEffect(() => {
    setSelectedSiteKeys(prev => {
      if (!selectedDay) {
        return prev.length === 0 ? prev : [];
      }
      const allowed = new Set(selectedDay.sites.map(site => site.key));
      const next = prev.filter(key => allowed.has(key));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedDay]);

  const allSiteKeys = selectedDay?.sites.map(site => site.key) ?? [];
  const allSelected = allSiteKeys.length > 0 && allSiteKeys.every(key => selectedSiteKeys.includes(key));
  const someSelected = selectedSiteKeys.length > 0 && !allSelected;
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

  const onOrganize = () => {
    setActiveSite(null);
    setActiveRecordId(null);
    setSelectedSiteKeys([]);
    setStatus('');
  };

  const onClear = async () => {
    if (activeSite) {
      return;
    }
    if (selectedSiteKeys.length > 0 && selectedDay) {
      const picked = selectedDay.sites.filter(site => selectedSiteKeys.includes(site.key));
      const count = picked.reduce((sum, site) => sum + site.records.length, 0);
      if (!window.confirm(`删除已选 ${picked.length} 个文件夹（共 ${count} 条）？`)) {
        return;
      }
      await Promise.all(picked.flatMap(site => site.records.map(record => deleteBrowsePage(record.id))));
      setSelectedSiteKeys([]);
      setStatus('已删除所选');
      await refresh();
      return;
    }
    if (!window.confirm('清空全部浏览记录？')) {
      return;
    }
    await clearBrowsePages();
    setActiveSite(null);
    setActiveRecordId(null);
    setSelectedSiteKeys([]);
    setStatus('已清空');
    await refresh();
  };

  const toggleSelectAll = () => {
    if (!selectedDay || selectedDay.sites.length === 0) {
      return;
    }
    setSelectedSiteKeys(allSelected ? [] : selectedDay.sites.map(site => site.key));
  };

  const toggleSiteSelected = (siteKey: string) => {
    setSelectedSiteKeys(prev => (prev.includes(siteKey) ? prev.filter(key => key !== siteKey) : [...prev, siteKey]));
  };

  const activeRecord = activeSite?.site.records.find(item => item.id === activeRecordId) ?? null;

  return (
    <div className={cn('side-panel sm-shell browse-shell', !isLight && 'sm-shell--dark')}>
      <main className="sm-shell__main browse-shell__main">
        {!activeSite ? (
          <div className="browse-toolbar">
            <BrowseDayCalendar
              selectedDateKey={selectedDateKey}
              recordDateKeys={recordDateKeys}
              dayLabel={selectedDay?.dayLabel ?? formatDayLabel(selectedDateKey)}
              total={selectedDay?.total ?? 0}
              onSelect={dateKey => {
                setSelectedDateKey(dateKey);
                setActiveSite(null);
                setActiveRecordId(null);
                setSelectedSiteKeys([]);
              }}
              onRefresh={() => void refresh()}
            />
          </div>
        ) : null}

        <div className="browse-shell__scroll">
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
            <section className="browse-day">
              {daySiteGroups.length === 0 ? <p className="sm-shell__muted">暂无记录</p> : null}
              {daySiteGroups.length > 0 && !selectedDay ? (
                <p className="sm-shell__muted">这一天还没有浏览记录</p>
              ) : null}
              {selectedDay ? (
                <div className="folder-card-grid">
                  {selectedDay.sites.map(site => {
                    const checked = selectedSiteKeys.includes(site.key);
                    return (
                      <article
                        key={`${selectedDay.dateKey}::${site.key}`}
                        className={cn(
                          'folder-card',
                          `folder-card--${site.accent}`,
                          checked && 'folder-card--selected',
                        )}>
                        <label className="folder-card__check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSiteSelected(site.key)}
                            aria-label={`选择 ${site.label}`}
                          />
                        </label>
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
                                setActiveSite({ dayKey: selectedDay.dateKey, site });
                                setActiveRecordId(null);
                              }}>
                              查看
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          )}
        </div>
      </main>

      <footer className="browse-dock" aria-label="浏览记录操作">
        <div className="browse-dock__left">
          <label
            className={cn(
              'browse-dock__check',
              (activeSite || allSiteKeys.length === 0) && 'browse-dock__check--disabled',
            )}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => {
                if (el) {
                  el.indeterminate = someSelected;
                }
              }}
              disabled={Boolean(activeSite) || allSiteKeys.length === 0}
              onChange={toggleSelectAll}
            />
            <span>全选</span>
          </label>
          {!activeSite && selectedSiteKeys.length > 0 ? (
            <span className="browse-dock__selected">已选中 {selectedSiteKeys.length}</span>
          ) : null}
        </div>
        <div className="browse-dock__actions">
          {!activeSite && groups.length > 0 ? (
            <Button size="sm" variant="secondary" className="browse-dock__btn" onClick={() => void onClear()}>
              清空
            </Button>
          ) : null}
          <Button size="sm" className="browse-dock__btn browse-dock__btn--primary" onClick={onOrganize}>
            整理
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default BrowseRecordsPanel;
