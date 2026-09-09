import BrowseDayCalendar, { toLocalDateKey } from './browse-day-calendar';
import {
  clearBrowsePages,
  deleteBrowsePage,
  listBrowsePagesGroupedByDay,
  listSelectionFavorites,
} from '@extension/knowledge-base';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { Button, cn } from '@extension/ui';
import BackIconButton from '@src/components/back-icon-button';
import { useConfirm } from '@src/components/confirm-dialog';
import { buildOrganizeCardFromSite } from '@src/features/organize';
import { formatRelativeDateKeyLabel } from '@src/lib/format-relative';
import {
  attachFavoritesToBrowseFolders,
  folderCountLabel,
  folderLabel,
  folderSheetCount,
  parseSite,
} from '@src/lib/site-folder';
import { Bookmark } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BrowseDayGroup, BrowsePageRecord, SelectionFavorite } from '@extension/knowledge-base';
import type { OrganizeCardPayload } from '@src/features/organize';
import type { SiteFolder } from '@src/lib/site-folder';

type DaySiteGroup = {
  dateKey: string;
  dayLabel: string;
  sites: SiteFolder[];
  total: number;
  browseTotal: number;
  favoriteTotal: number;
};

const MAX_SHEETS = 3;

const BrowseEmptyState = ({ title, onFocus }: { title: string; onFocus: () => void }) => (
  <div className="browse-empty">
    <p className="browse-empty__title">{title}</p>
    <p className="browse-empty__hint">
      请先
      <button type="button" className="browse-empty__link" onClick={onFocus}>
        专注
      </button>
      学习，结束后再来做整理
    </p>
  </div>
);

const formatDayLabel = formatRelativeDateKeyLabel;

const groupByDayThenSite = (dayGroups: BrowseDayGroup[], favorites: SelectionFavorite[]): DaySiteGroup[] =>
  dayGroups.map(day => {
    const map = new Map<string, BrowsePageRecord[]>();
    for (const record of day.records) {
      const { key } = parseSite(record.url);
      const bucket = map.get(key) ?? [];
      bucket.push(record);
      map.set(key, bucket);
    }

    const base = [...map.entries()]
      .map(([key, records], index) => {
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
      })
      .sort((a, b) => (b.browseRecords[0]?.recordedAt ?? 0) - (a.browseRecords[0]?.recordedAt ?? 0));

    const sites = attachFavoritesToBrowseFolders(base, favorites, day.dateKey);
    const favoriteTotal = sites.reduce((sum, site) => sum + site.favorites.length, 0);

    return {
      dateKey: day.dateKey,
      dayLabel: formatDayLabel(day.dateKey),
      sites,
      browseTotal: day.records.length,
      favoriteTotal,
      total: day.records.length + favoriteTotal,
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

const FolderSheets = ({ count, favoriteMark = false }: { count: number; favoriteMark?: boolean }) => {
  const sheets = Math.max(1, Math.min(MAX_SHEETS, count));
  return (
    <div className="folder-card__stage">
      {Array.from({ length: sheets }, (_, index) => {
        const fromBack = sheets - 1 - index;
        return (
          <span key={index} className={`folder-card__hit folder-card__hit--${fromBack}`}>
            <span className={`folder-card__sheet folder-card__sheet--${fromBack}`}>
              {favoriteMark && fromBack === 0 ? (
                <span className="folder-card__fav-mark" aria-hidden="true">
                  <Bookmark size={12} strokeWidth={2.6} absoluteStrokeWidth />
                </span>
              ) : null}
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
  onBack?: () => void;
  embedded?: boolean;
  selectedDateKey?: string;
  onSelectedDateKeyChange?: (dateKey: string) => void;
  onRecordDateKeysChange?: (keys: Set<string>) => void;
  onRefreshReady?: (refresh: () => Promise<void>) => void;
  onDayTotalChange?: (total: number) => void;
  favoritesNonce?: number;
  /** 底栏：打开整理页 */
  onOrganizeRequest?: (payload: { dateKey: string; siteKeys: string[] }) => void;
  /** 文件夹「查看」→ 资料详情 */
  onOpenMaterialDetail?: (card: OrganizeCardPayload) => void;
};

const BrowseRecordsPanel = ({
  isLight,
  onBack,
  embedded = false,
  selectedDateKey: selectedDateKeyProp,
  onSelectedDateKeyChange,
  onRecordDateKeysChange,
  onRefreshReady,
  onDayTotalChange,
  favoritesNonce = 0,
  onOrganizeRequest,
  onOpenMaterialDetail,
}: BrowseRecordsPanelProps) => {
  const confirm = useConfirm();
  const [groups, setGroups] = useState<BrowseDayGroup[]>([]);
  const [favorites, setFavorites] = useState<SelectionFavorite[]>([]);
  const [selectedDateKeyState, setSelectedDateKeyState] = useState(() => toLocalDateKey(new Date()));
  const selectedDateKey = selectedDateKeyProp ?? selectedDateKeyState;
  const setSelectedDateKey = onSelectedDateKeyChange ?? setSelectedDateKeyState;
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = '整理 · 浏览记录';
  }, []);

  useEffect(() => {
    if (!status) {
      return;
    }
    const timer = window.setTimeout(() => setStatus(''), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  const refresh = useCallback(async () => {
    try {
      const [nextGroups, nextFavorites] = await Promise.all([listBrowsePagesGroupedByDay(), listSelectionFavorites()]);
      setGroups(nextGroups);
      setFavorites(nextFavorites);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载浏览记录失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, favoritesNonce]);

  useEffect(() => {
    onRefreshReady?.(refresh);
  }, [onRefreshReady, refresh]);

  const daySiteGroups = useMemo(() => groupByDayThenSite(groups, favorites), [groups, favorites]);
  const recordDateKeys = useMemo(() => new Set(daySiteGroups.map(day => day.dateKey)), [daySiteGroups]);

  useEffect(() => {
    onRecordDateKeysChange?.(recordDateKeys);
  }, [onRecordDateKeysChange, recordDateKeys]);

  const didInitDateRef = useRef(false);

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
  }, [daySiteGroups, recordDateKeys, selectedDateKey, setSelectedDateKey]);

  const selectedDay = useMemo(
    () => daySiteGroups.find(day => day.dateKey === selectedDateKey) ?? null,
    [daySiteGroups, selectedDateKey],
  );

  useEffect(() => {
    onDayTotalChange?.(selectedDay?.total ?? 0);
  }, [onDayTotalChange, selectedDay?.total]);

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

  const onOrganize = () => {
    if (!selectedDay || selectedDay.sites.length === 0) {
      setStatus('暂无可整理内容');
      return;
    }
    const siteKeys = selectedSiteKeys.length > 0 ? [...selectedSiteKeys] : selectedDay.sites.map(site => site.key);
    onOrganizeRequest?.({ dateKey: selectedDay.dateKey, siteKeys });
    setStatus('');
  };

  const onClear = async () => {
    if (selectedSiteKeys.length > 0 && selectedDay) {
      const picked = selectedDay.sites.filter(site => selectedSiteKeys.includes(site.key));
      const count = picked.reduce((sum, site) => sum + site.browseRecords.length, 0);
      const ok = await confirm({
        title: `删除已选 ${picked.length} 个文件夹？`,
        message: `将删除其中共 ${count} 条浏览记录。收藏不会删除。`,
        confirmLabel: '删除',
        cancelLabel: '取消',
        tone: 'danger',
      });
      if (!ok) {
        return;
      }
      await Promise.all(picked.flatMap(site => site.browseRecords.map(record => deleteBrowsePage(record.id))));
      setSelectedSiteKeys([]);
      setStatus('已删除所选浏览');
      await refresh();
      return;
    }
    const ok = await confirm({
      title: '清空全部浏览记录？',
      message: '收藏不会删除。',
      confirmLabel: '清空',
      cancelLabel: '取消',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }
    await clearBrowsePages();
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

  const startFocus = async () => {
    try {
      await sendExtensionMessage(ExtensionMessageType.POMODORO_START, {});
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法开始专注');
    }
  };

  const shellRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLFooterElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const dock = dockRef.current;
    if (!shell || !dock) {
      return;
    }

    const syncDockSpace = () => {
      const styles = getComputedStyle(shell);
      const gapRaw = styles.getPropertyValue('--browse-dock-gap').trim();
      const gap = Number.parseFloat(gapRaw) || 10;
      const space = Math.ceil(dock.getBoundingClientRect().height + gap);
      shell.style.setProperty('--browse-dock-space', `${space}px`);
    };

    syncDockSpace();
    const observer = new ResizeObserver(() => syncDockSpace());
    observer.observe(dock);
    window.addEventListener('resize', syncDockSpace);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncDockSpace);
    };
  }, []);

  useEffect(() => {
    const dock = dockRef.current;
    const scroll = scrollRef.current;
    if (!dock || !scroll) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      scroll.scrollTop += event.deltaY;
    };

    dock.addEventListener('wheel', onWheel, { passive: true });
    return () => dock.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={shellRef}
      className={cn(
        'side-panel sm-shell browse-shell',
        embedded && 'browse-shell--embedded',
        !isLight && 'sm-shell--dark',
      )}>
      <main className="sm-shell__main browse-shell__main">
        {embedded ? null : (
          <div className="browse-toolbar">
            {onBack ? <BackIconButton onClick={onBack} className="browse-toolbar__back-icon" /> : null}
            <div className="browse-toolbar__cal">
              <BrowseDayCalendar
                selectedDateKey={selectedDateKey}
                recordDateKeys={recordDateKeys}
                dayLabel={selectedDay?.dayLabel ?? formatDayLabel(selectedDateKey)}
                total={selectedDay?.total ?? 0}
                onSelect={dateKey => {
                  setSelectedDateKey(dateKey);
                  setSelectedSiteKeys([]);
                }}
                onRefresh={() => void refresh()}
              />
            </div>
          </div>
        )}

        <div className="browse-shell__scroll" ref={scrollRef}>
          {status ? <p className="browse-shell__toast">{status}</p> : null}
          {error ? <p className="text-xs text-red-700">{error}</p> : null}

          <section className="browse-day">
            {daySiteGroups.length === 0 ? (
              <BrowseEmptyState title="暂无需整理的文件" onFocus={() => void startFocus()} />
            ) : null}
            {daySiteGroups.length > 0 && !selectedDay ? (
              <BrowseEmptyState title="暂无需整理的文件" onFocus={() => void startFocus()} />
            ) : null}
            {selectedDay ? (
              <div className="folder-card-grid">
                {selectedDay.sites.map(site => {
                  const checked = selectedSiteKeys.includes(site.key);
                  return (
                    <article
                      key={`${selectedDay.dateKey}::${site.key}`}
                      className={cn('folder-card', `folder-card--${site.accent}`, checked && 'folder-card--selected')}>
                      <label className="folder-card__check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSiteSelected(site.key)}
                          aria-label={`选择 ${site.label}`}
                        />
                      </label>
                      <div className="folder-card__preview" />
                      <FolderSheets count={folderSheetCount(site)} favoriteMark={site.favorites.length > 0} />
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
                            {folderCountLabel(site.browseRecords.length, site.favorites.length)}
                          </span>
                          <button
                            type="button"
                            className="folder-card__open"
                            onClick={() => {
                              onOpenMaterialDetail?.(buildOrganizeCardFromSite(selectedDay.dateKey, site));
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
          <div className="browse-shell__scroll-spacer" aria-hidden="true" />
        </div>
      </main>

      <footer ref={dockRef} className="browse-dock" aria-label="浏览记录操作">
        <div className="browse-dock__left">
          <label className={cn('browse-dock__check', allSiteKeys.length === 0 && 'browse-dock__check--disabled')}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => {
                if (el) {
                  el.indeterminate = someSelected;
                }
              }}
              disabled={allSiteKeys.length === 0}
              onChange={toggleSelectAll}
            />
            <span>全选</span>
          </label>
          {selectedSiteKeys.length > 0 ? (
            <span className="browse-dock__selected">已选中 {selectedSiteKeys.length}</span>
          ) : null}
        </div>
        <div className="browse-dock__actions">
          {groups.length > 0 ? (
            <Button size="sm" variant="secondary" className="browse-dock__btn" onClick={() => void onClear()}>
              清空
            </Button>
          ) : null}
          <Button
            size="sm"
            className="browse-dock__btn browse-dock__btn--primary"
            disabled={!selectedDay || selectedDay.sites.length === 0}
            onClick={onOrganize}>
            加入整理
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default BrowseRecordsPanel;
