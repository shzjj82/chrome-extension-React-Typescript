import OrganizeList from './organize-list';
import { resolveBrowseItems, resolveFavoriteItems } from './organize-source';
import { cn } from '@extension/ui';
import BackIconButton from '@src/components/back-icon-button';
import PhoneStatusBar from '@src/components/phone-status-bar';
import FavoriteSheet from '@src/features/files-hub/favorite-sheet';
import { useAppHeader } from '@src/layouts';
import { useEffect, useMemo, useState } from 'react';
import type { OrganizeCardPayload } from './organize-card';
import type { OrganizeSource } from './organize-source';
import type { SelectionFavorite } from '@extension/knowledge-base';

type OrganizeReadonlyProps = {
  isLight: boolean;
  onBack: () => void;
  card: OrganizeCardPayload;
  pageMode?: boolean;
  hideChrome?: boolean;
};

const OrganizeReadonly = ({ isLight, onBack, card, pageMode = false, hideChrome = false }: OrganizeReadonlyProps) => {
  const [sheetFavorite, setSheetFavorite] = useState<SelectionFavorite | null>(null);

  const source = useMemo<OrganizeSource>(() => ({ kind: 'card', card }), [card]);
  const browseItems = useMemo(() => resolveBrowseItems(source), [source]);
  const favoriteItems = useMemo(() => resolveFavoriteItems(source), [source]);
  const empty = browseItems.length === 0 && favoriteItems.length === 0;

  useEffect(() => {
    document.title = '资料详情';
  }, []);

  useAppHeader('资料详情', {
    onBack,
    enabled: !pageMode && !hideChrome,
    syncKey: '资料详情',
  });

  const openBrowsePage = (url: string) => {
    const target = url.trim();
    if (!target) {
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      void chrome.tabs.create({ url: target });
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={cn(
        'sm-shell organize-panel organize-panel--readonly',
        pageMode && 'side-panel organize-panel--page',
        hideChrome && 'organize-panel--embedded',
        !isLight && 'sm-shell--dark',
      )}>
      {pageMode && !hideChrome ? (
        <>
          <PhoneStatusBar className="organize-panel__status" clockLeft />
          <header className="organize-panel__header">
            <BackIconButton className="organize-panel__back" iconSize={16} onClick={onBack} />
            <h1 className="organize-panel__title">资料详情</h1>
            <span className="organize-panel__header-spacer" aria-hidden="true" />
          </header>
        </>
      ) : null}

      <div className="organize-panel__scroll">
        {empty ? (
          <div className="browse-empty">
            <p className="browse-empty__title">这份资料没有内容</p>
            <p className="browse-empty__hint">返回继续查看</p>
          </div>
        ) : (
          <OrganizeList
            browseItems={browseItems}
            favoriteItems={favoriteItems}
            onOpenBrowse={openBrowsePage}
            onOpenFavorite={setSheetFavorite}
          />
        )}
      </div>

      <FavoriteSheet
        favorite={sheetFavorite}
        isLight={isLight}
        onClose={() => setSheetFavorite(null)}
        sourceLabel="提问收藏"
        markdownAnswers={false}
      />
    </div>
  );
};

export default OrganizeReadonly;
