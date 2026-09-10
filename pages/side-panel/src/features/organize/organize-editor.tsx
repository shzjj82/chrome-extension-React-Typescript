import { encodeOrganizeCard, organizeCardCountLabel, organizeCardPreview } from './organize-card';
import { buildOrganizeCard, buildSitesForDay, flattenGroups } from './organize-format';
import OrganizeList from './organize-list';
import {
  ensurePetChatThread,
  listBrowsePagesGroupedByDay,
  listSelectionFavorites,
  PetChatChannel,
  savePetChatMessage,
  savePetChatThread,
} from '@extension/knowledge-base';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { cn } from '@extension/ui';
import BackIconButton from '@src/components/back-icon-button';
import PhoneStatusBar from '@src/components/phone-status-bar';
import FavoriteSheet from '@src/features/files-hub/favorite-sheet';
import { useAppHeader } from '@src/layouts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SelectionFavorite } from '@extension/knowledge-base';
import type { SiteFolder } from '@src/lib/site-folder';

type OrganizeEditorProps = {
  isLight: boolean;
  onBack: () => void;
  dateKey?: string;
  siteKeys?: string[];
  pageMode?: boolean;
  /** @deprecated 使用 onOrganizeSent */
  onSentToMessages?: () => void;
  /** 整理会话写入成功后回调（带 threadId） */
  onOrganizeSent?: (threadId: string) => void;
  hideChrome?: boolean;
};

const OrganizeEditor = ({
  isLight,
  dateKey = '',
  siteKeys = [],
  onBack,
  pageMode = false,
  onSentToMessages,
  onOrganizeSent,
  hideChrome = false,
}: OrganizeEditorProps) => {
  const [sites, setSites] = useState<SiteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetFavorite, setSheetFavorite] = useState<SelectionFavorite | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [sendHint, setSendHint] = useState('');

  const { browseItems, favoriteItems } = useMemo(() => flattenGroups(sites), [sites]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dayGroups, favorites] = await Promise.all([listBrowsePagesGroupedByDay(), listSelectionFavorites()]);
      const day = dayGroups.find(item => item.dateKey === dateKey);
      const next = buildSitesForDay(dateKey, siteKeys, day?.records ?? [], favorites);
      setSites(next);
      const flat = flattenGroups(next);
      setSelected(new Set([...flat.browseItems, ...flat.favoriteItems].map(item => item.key)));
      setSendHint('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载整理材料失败');
      setSites([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [dateKey, siteKeys]);

  useEffect(() => {
    if (!dateKey) {
      setLoading(false);
      setSites([]);
      setSelected(new Set());
      return;
    }
    void load();
  }, [dateKey, load]);

  useEffect(() => {
    document.title = '开始整理';
  }, []);

  const summary = useMemo(
    () => ({
      empty: browseItems.length === 0 && favoriteItems.length === 0,
    }),
    [browseItems.length, favoriteItems.length],
  );

  const selectedCount = selected.size;
  const allKeys = useMemo(() => [...browseItems, ...favoriteItems].map(item => item.key), [browseItems, favoriteItems]);
  const allSelected = allKeys.length > 0 && selectedCount === allKeys.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleKey = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allKeys));
  };

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

  const sendOrganize = async () => {
    if (sending || selectedCount === 0) {
      return;
    }
    setSending(true);
    setError('');
    setSendHint('');
    try {
      const cardPayload = buildOrganizeCard(dateKey, browseItems, favoriteItems, selected);
      if (cardPayload.browse.length + cardPayload.favorites.length === 0) {
        throw new Error('请先勾选要发送的材料');
      }

      const title = '整理';
      const preview = organizeCardPreview(cardPayload);
      const thread = await ensurePetChatThread({
        channel: PetChatChannel.Organize,
        title,
      });
      await savePetChatMessage({
        threadId: thread.id,
        role: 'user',
        content: encodeOrganizeCard(cardPayload),
      });
      await savePetChatThread({
        id: thread.id,
        title,
        titleStatus: 'ready',
        channel: PetChatChannel.Organize,
        preview,
        createdAt: thread.createdAt,
      });

      setSendHint(`已加入整理（${organizeCardCountLabel(cardPayload)}）`);
      if (onOrganizeSent) {
        onOrganizeSent(thread.id);
      } else if (onSentToMessages) {
        onSentToMessages();
      } else {
        await sendExtensionMessage(ExtensionMessageType.OPEN_SIDE_PANEL, { view: 'chat' }).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  useAppHeader('开始整理', {
    onBack,
    enabled: !pageMode && !hideChrome,
    syncKey: '开始整理',
  });

  return (
    <div
      className={cn(
        'sm-shell organize-panel',
        pageMode && 'side-panel organize-panel--page',
        hideChrome && 'organize-panel--embedded',
        !isLight && 'sm-shell--dark',
      )}>
      {pageMode && !hideChrome ? (
        <>
          <PhoneStatusBar className="organize-panel__status" clockLeft />
          <header className="organize-panel__header">
            <BackIconButton className="organize-panel__back" iconSize={16} onClick={onBack} />
            <h1 className="organize-panel__title">开始整理</h1>
            <span className="organize-panel__header-spacer" aria-hidden="true" />
          </header>
        </>
      ) : null}

      <div className="organize-panel__scroll">
        {loading ? <p className="organize-panel__hint">加载中…</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        {sendHint ? <p className="organize-panel__hint organize-panel__hint--ok">{sendHint}</p> : null}

        {!loading && !error && (summary.empty || !dateKey) ? (
          <div className="browse-empty">
            <p className="browse-empty__title">{dateKey ? '这一天没有可整理的内容' : '没有整理材料'}</p>
            <p className="browse-empty__hint">
              {dateKey ? '换个日期，或先去专注留下浏览快照、去提问页收藏' : '请从文件页的专注分区点击「加入整理」打开'}
            </p>
          </div>
        ) : null}

        {!loading ? (
          <OrganizeList
            browseItems={browseItems}
            favoriteItems={favoriteItems}
            showChecks
            selected={selected}
            onToggleKey={toggleKey}
            onOpenBrowse={openBrowsePage}
            onOpenFavorite={setSheetFavorite}
          />
        ) : null}

        {!loading && !summary.empty ? <div className="organize-panel__scroll-spacer" aria-hidden="true" /> : null}
      </div>

      {!loading && !summary.empty ? (
        <footer className="browse-dock organize-panel__dock" aria-label="整理操作">
          <div className="browse-dock__left">
            <label className="browse-dock__check">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => {
                  if (el) {
                    el.indeterminate = someSelected;
                  }
                }}
                onChange={toggleAll}
              />
              <span>全选</span>
            </label>
            {selectedCount > 0 ? <span className="browse-dock__selected">已选中 {selectedCount}</span> : null}
          </div>
          <div className="browse-dock__actions">
            <button
              type="button"
              className="browse-dock__btn browse-dock__btn--primary"
              disabled={sending || selectedCount === 0}
              onClick={() => void sendOrganize()}>
              {sending ? '整理中…' : '开始整理'}
            </button>
          </div>
        </footer>
      ) : null}

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

export default OrganizeEditor;
