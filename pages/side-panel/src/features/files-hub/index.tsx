import BrowseDayCalendar, { toLocalDateKey } from './browse-day-calendar';
import BrowseRecordsPanel from './browse-records';
import SelectionAskPanel from './selection-ask';
import { useAppHeader } from '../../layouts';
import { parseDateKey } from '../../lib/dayjs';
import { PATHS, filesTabFromPath, isFilesHubTab, isFilesPath } from '../../lib/routes';
import OrganizePanel from '../organize';
import { cn, SegmentedSwitch } from '@extension/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { FilesHubTab } from '../../lib/routes';
import type { OrganizeCardPayload, OrganizePayload } from '../organize';

type FilesHubPanelProps = {
  isLight: boolean;
  onBack?: () => void;
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

const FilesHubPanel = ({ isLight, onBack, onOrganizeRequest }: FilesHubPanelProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tab = filesTabFromPath(location.pathname);

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
    if (location.pathname === PATHS.files || location.pathname === `${PATHS.files}/`) {
      navigate(PATHS.filesTab('focus'), { replace: true });
      return;
    }
    const segment = location.pathname.match(/^\/files\/([^/]+)/)?.[1];
    if (segment && !isFilesHubTab(segment)) {
      navigate(PATHS.filesTab('focus'), { replace: true });
    }
  }, [location.pathname, navigate]);

  const setTab = useCallback(
    (next: FilesHubTab) => {
      navigate(PATHS.filesTab(next), { replace: true });
    },
    [navigate],
  );

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

  const closeMaterialDetail = useCallback(() => {
    setMaterialDetail(null);
  }, []);

  useAppHeader(materialDetail ? '资料详情' : TAB_TITLE[tab], {
    onBack: materialDetail ? closeMaterialDetail : onBack,
    enabled: isFilesPath(location.pathname),
    syncKey: materialDetail ? 'detail' : tab,
  });

  return (
    <div className={cn('sm-shell files-hub', !isLight && 'sm-shell--dark')}>
      <div
        className={cn('files-hub__shell', materialDetail && 'files-hub__shell--hidden')}
        aria-hidden={Boolean(materialDetail)}>
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
          <OrganizePanel isLight={isLight} readOnly card={materialDetail} onBack={closeMaterialDetail} hideChrome />
        </div>
      ) : null}
    </div>
  );
};

export default FilesHubPanel;
export type { FilesHubTab };
