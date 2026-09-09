import BackIconButton from './BackIconButton';
import BrowseDayCalendar, { toLocalDateKey } from './BrowseDayCalendar';
import BrowseRecordsPanel from './BrowseRecordsPanel';
import { parseDateKey } from './lib/dayjs';
import OrganizePanel from './OrganizePanel';
import PhoneStatusBar from './PhoneStatusBar';
import SelectionAskPanel from './SelectionAskPanel';
import { cn, SegmentedSwitch } from '@extension/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrganizeCardPayload } from './lib/organizeCard';
import type { OrganizePayload } from './OrganizePanel';

type FilesHubTab = 'favorites' | 'ask' | 'focus';

type FilesHubPanelProps = {
  isLight: boolean;
  onBack?: () => void;
  initialTab?: FilesHubTab;
  onOrganizeRequest?: (payload: OrganizePayload) => void;
};

const TAB_TITLE: Record<FilesHubTab, string> = {
  favorites: '收藏',
  ask: '提问',
  focus: '专注',
};

const formatDayLabel = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return date ? date.format('YYYY/M/D') : dateKey;
};

const FilesHubPanel = ({ isLight, onBack, initialTab = 'focus', onOrganizeRequest }: FilesHubPanelProps) => {
  const [tab, setTab] = useState<FilesHubTab>(initialTab);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toLocalDateKey(new Date()));
  const [browseDateKeys, setBrowseDateKeys] = useState<Set<string>>(() => new Set());
  const [favoriteDateKeys, setFavoriteDateKeys] = useState<Set<string>>(() => new Set());
  const [browseDayTotal, setBrowseDayTotal] = useState(0);
  const [favoriteDayTotal, setFavoriteDayTotal] = useState(0);
  const [favoritesNonce, setFavoritesNonce] = useState(0);
  const [materialDetail, setMaterialDetail] = useState<OrganizeCardPayload | null>(null);
  const focusRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const favoritesRefreshRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    document.title = materialDetail ? '资料详情' : '文件';
  }, [materialDetail]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const onBrowseDateKeysChange = useCallback((keys: Set<string>) => {
    setBrowseDateKeys(new Set(keys));
  }, []);

  const onFavoriteDateKeysChange = useCallback((keys: Set<string>) => {
    setFavoriteDateKeys(new Set(keys));
  }, []);

  const onFocusRefreshReady = useCallback((refresh: () => Promise<void>) => {
    focusRefreshRef.current = refresh;
  }, []);

  const onFavoritesRefreshReady = useCallback((refresh: () => Promise<void>) => {
    favoritesRefreshRef.current = async () => {
      await refresh();
      setFavoritesNonce(value => value + 1);
    };
  }, []);

  const onFavoritesUpdated = useCallback(() => {
    setFavoritesNonce(value => value + 1);
  }, []);

  const onOpenMaterialDetail = useCallback((card: OrganizeCardPayload) => {
    setMaterialDetail(card);
  }, []);

  const onRefresh = () => {
    if (tab === 'focus') {
      void focusRefreshRef.current?.();
      return;
    }
    if (tab === 'favorites') {
      void favoritesRefreshRef.current?.();
    }
  };

  const dayLabel = useMemo(() => formatDayLabel(selectedDateKey), [selectedDateKey]);
  const calendarDateKeys = tab === 'favorites' ? favoriteDateKeys : browseDateKeys;
  const dayTotal = tab === 'favorites' ? favoriteDayTotal : browseDayTotal;
  const calendarHidden = tab === 'ask';

  const onBrowseDayTotalChange = useCallback((total: number) => {
    setBrowseDayTotal(total);
  }, []);

  const onFilteredFavoritesCountChange = useCallback((count: number) => {
    setFavoriteDayTotal(count);
  }, []);

  return (
    <div className={cn('side-panel sm-shell files-hub', !isLight && 'sm-shell--dark')}>
      <div
        className={cn('files-hub__shell', materialDetail && 'files-hub__shell--hidden')}
        aria-hidden={Boolean(materialDetail)}>
        <PhoneStatusBar className="files-hub__status" clockLeft />

        <header className="files-hub__header">
          {onBack ? (
            <BackIconButton className="files-hub__back" iconSize={16} onClick={onBack} />
          ) : (
            <span className="files-hub__header-spacer" />
          )}
          <h1 className="files-hub__title">{TAB_TITLE[tab]}</h1>
          <span className="files-hub__header-spacer" aria-hidden="true" />
        </header>

        <div className="files-hub__toolbar">
          <div className={cn('files-hub__cal', calendarHidden && 'files-hub__cal--calendar-hidden')}>
            <BrowseDayCalendar
              selectedDateKey={selectedDateKey}
              recordDateKeys={calendarDateKeys}
              dayLabel={dayLabel}
              total={dayTotal}
              hideCalendar={calendarHidden}
              onSelect={setSelectedDateKey}
              onRefresh={onRefresh}
            />
          </div>
          <SegmentedSwitch
            className="files-hub__tabs"
            aria-label="文件分区"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'ask', label: '提问' },
              { value: 'focus', label: '专注' },
              { value: 'favorites', label: '收藏' },
            ]}
          />
        </div>

        <div className="files-hub__body">
          <div
            className={cn('files-hub__pane', tab === 'focus' && 'files-hub__pane--active')}
            aria-hidden={tab !== 'focus'}>
            <BrowseRecordsPanel
              isLight={isLight}
              embedded
              selectedDateKey={selectedDateKey}
              onSelectedDateKeyChange={setSelectedDateKey}
              onRecordDateKeysChange={onBrowseDateKeysChange}
              onRefreshReady={onFocusRefreshReady}
              onDayTotalChange={onBrowseDayTotalChange}
              favoritesNonce={favoritesNonce}
              onOrganizeRequest={onOrganizeRequest}
              onOpenMaterialDetail={onOpenMaterialDetail}
            />
          </div>
          <div
            className={cn('files-hub__pane', (tab === 'ask' || tab === 'favorites') && 'files-hub__pane--active')}
            aria-hidden={tab !== 'ask' && tab !== 'favorites'}>
            <SelectionAskPanel
              isLight={isLight}
              embedded
              embeddedTab={tab === 'favorites' ? 'favorites' : 'ask'}
              filterDateKey={tab === 'favorites' ? selectedDateKey : undefined}
              onRequestAskTab={() => setTab('ask')}
              onFavoritesRefreshReady={onFavoritesRefreshReady}
              onFavoriteDateKeysChange={onFavoriteDateKeysChange}
              onFilteredFavoritesCountChange={onFilteredFavoritesCountChange}
              onFavoritesUpdated={onFavoritesUpdated}
            />
          </div>
        </div>
      </div>

      {materialDetail ? (
        <div className="files-hub__detail">
          <OrganizePanel isLight={isLight} readOnly card={materialDetail} onBack={() => setMaterialDetail(null)} />
        </div>
      ) : null}
    </div>
  );
};

export default FilesHubPanel;
export type { FilesHubTab };
