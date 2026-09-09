import { encodeOrganizeCard, ORGANIZE_CARD_KIND, organizeCardCountLabel, organizeCardPreview } from './organize-card';
import BackIconButton from '../../components/back-icon-button';
import PhoneStatusBar from '../../components/phone-status-bar';
import SheetFrame from '../../components/sheet-frame';
import { useAppHeader } from '../../layouts';
import { attachFavoritesToBrowseFolders, folderLabel, parseSite } from '../../lib/site-folder';
import {
  createPetChatThread,
  listBrowsePagesGroupedByDay,
  listSelectionFavorites,
  savePetChatMessage,
  savePetChatThread,
} from '@extension/knowledge-base';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { cn } from '@extension/ui';
import { ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrganizeCardFavoriteItem, OrganizeCardPayload } from './organize-card';
import type { SiteFolder } from '../../lib/site-folder';
import type { BrowsePageRecord, SelectionFavorite } from '@extension/knowledge-base';

type OrganizePayload = {
  dateKey: string;
  siteKeys: string[];
};

type OrganizePanelProps = {
  isLight: boolean;
  onBack: () => void;
  /** 选择模式：从专注页带入 */
  dateKey?: string;
  siteKeys?: string[];
  /** 独立浏览器标签全页（类似设置） */
  pageMode?: boolean;
  /** 发送到短信成功后（侧栏内跳转） */
  onSentToMessages?: () => void;
  /** 只读查看：短信卡片打开 */
  readOnly?: boolean;
  card?: OrganizeCardPayload | null;
  /** 已由壳层顶栏托管时隐藏本页 status+header */
  hideChrome?: boolean;
};

type BrowseItem = {
  key: string;
  record: BrowsePageRecord;
  siteLabel: string;
  siteOrigin: string;
};

type FavoriteItem = {
  key: string;
  favorite: SelectionFavorite;
  siteLabel: string;
};

const browseKey = (id: string) => `browse:${id}`;
const favoriteKey = (id: string) => `fav:${id}`;

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

const favoriteFromCard = (item: OrganizeCardFavoriteItem): SelectionFavorite => ({
  id: item.id,
  text: item.text,
  sourceUrl: item.sourceUrl,
  pageTitle: item.pageTitle,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  messages: item.messages ?? [],
  links: item.links ?? [],
});

const OrganizePanel = ({
  isLight,
  dateKey = '',
  siteKeys = [],
  onBack,
  pageMode = false,
  onSentToMessages,
  readOnly = false,
  card = null,
  hideChrome = false,
}: OrganizePanelProps) => {
  const viewingCard = readOnly && card ? card : null;
  const [sites, setSites] = useState<SiteFolder[]>([]);
  const [loading, setLoading] = useState(!viewingCard);
  const [error, setError] = useState('');
  const [sheetFavorite, setSheetFavorite] = useState<SelectionFavorite | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [sendHint, setSendHint] = useState('');

  const loaded = useMemo(() => flattenGroups(sites), [sites]);

  const browseItems = useMemo(() => {
    if (viewingCard) {
      return viewingCard.browse.map(item => ({
        key: browseKey(item.id),
        record: {
          id: item.id,
          dateKey: viewingCard.dateKey,
          url: item.url,
          title: item.title,
          recordedAt: item.recordedAt,
          material: item.material ?? '',
          fingerprint: item.id,
          trigger: 'manual' as const,
          similarity: 1,
        } satisfies BrowsePageRecord,
        siteLabel: item.siteLabel,
        siteOrigin: '',
      }));
    }
    return loaded.browseItems;
  }, [viewingCard, loaded.browseItems]);

  const favoriteItems = useMemo(() => {
    if (viewingCard) {
      return viewingCard.favorites.map(item => ({
        key: favoriteKey(item.id),
        favorite: favoriteFromCard(item),
        siteLabel: item.siteLabel,
      }));
    }
    return loaded.favoriteItems;
  }, [viewingCard, loaded.favoriteItems]);

  const load = useCallback(async () => {
    if (viewingCard) {
      return;
    }
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
  }, [dateKey, siteKeys, viewingCard]);

  useEffect(() => {
    if (viewingCard) {
      setLoading(false);
      setSites([]);
      setSelected(new Set());
      return;
    }
    if (!dateKey) {
      setLoading(false);
      setSites([]);
      setSelected(new Set());
      return;
    }
    void load();
  }, [dateKey, load, viewingCard]);

  useEffect(() => {
    document.title = viewingCard ? '资料详情' : '开始整理';
  }, [viewingCard]);

  const summary = useMemo(
    () => ({
      browseTotal: browseItems.length,
      favoriteTotal: favoriteItems.length,
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

  const sendToMessages = async () => {
    if (viewingCard || sending || selectedCount === 0) {
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

      const title = `整理 · ${cardPayload.dayLabel}`;
      const preview = organizeCardPreview(cardPayload);
      const thread = await createPetChatThread(title);
      await savePetChatMessage({
        threadId: thread.id,
        role: 'user',
        content: encodeOrganizeCard(cardPayload),
      });
      await savePetChatThread({
        ...thread,
        title,
        titleStatus: 'ready',
        preview,
      });

      setSendHint(`已发送整理卡片（${organizeCardCountLabel(cardPayload)}）`);
      if (onSentToMessages) {
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

  const layoutTitle = viewingCard ? '资料详情' : '开始整理';
  useAppHeader(layoutTitle, {
    onBack,
    enabled: !pageMode && !hideChrome,
    syncKey: layoutTitle,
  });

  return (
    <div
      className={cn(
        'sm-shell organize-panel',
        pageMode && 'side-panel organize-panel--page',
        viewingCard && 'organize-panel--readonly',
        hideChrome && 'organize-panel--embedded',
        !isLight && 'sm-shell--dark',
      )}>
      {pageMode && !hideChrome ? (
        <>
          <PhoneStatusBar className="organize-panel__status" clockLeft />
          <header className="organize-panel__header">
            <BackIconButton className="organize-panel__back" iconSize={16} onClick={onBack} />
            <h1 className="organize-panel__title">{viewingCard ? '资料详情' : '开始整理'}</h1>
            <span className="organize-panel__header-spacer" aria-hidden="true" />
          </header>
        </>
      ) : null}

      <div className="organize-panel__scroll">
        {loading ? <p className="organize-panel__hint">加载中…</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        {sendHint ? <p className="organize-panel__hint organize-panel__hint--ok">{sendHint}</p> : null}

        {!loading && !error && (summary.empty || (!viewingCard && !dateKey)) ? (
          <div className="browse-empty">
            <p className="browse-empty__title">
              {viewingCard ? '这份资料没有内容' : dateKey ? '这一天没有可整理的内容' : '没有整理材料'}
            </p>
            <p className="browse-empty__hint">
              {viewingCard
                ? '返回继续查看'
                : dateKey
                  ? '换个日期，或先去专注留下浏览快照、去提问页收藏'
                  : '请从文件页的专注分区点击「加入整理」打开'}
            </p>
          </div>
        ) : null}

        {!loading && browseItems.length > 0 ? (
          <section className="organize-panel__group" aria-label="浏览快照">
            <h2 className="organize-panel__group-title">浏览快照</h2>
            <div className="folder-file-list organize-panel__list">
              {browseItems.map(item => {
                const checked = selected.has(item.key);
                return (
                  <article key={item.key} className="folder-file organize-panel__item">
                    <div className="organize-panel__item-row">
                      {viewingCard ? null : (
                        <label className="organize-panel__check organize-panel__check--item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleKey(item.key)}
                            onClick={event => event.stopPropagation()}
                            aria-label={`选择 ${pageLabel(item.record)}`}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        className="folder-file__row organize-panel__item-main"
                        onClick={() => openBrowsePage(item.record.url)}>
                        <span className="folder-file__body">
                          <span className="folder-file__title">{pageLabel(item.record)}</span>
                          <span className="folder-file__meta">
                            {item.siteLabel} · {formatTime(item.record.recordedAt)}
                            {item.record.material?.trim() ? ` · ${excerpt(item.record.material)}` : ' · （无正文快照）'}
                          </span>
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && favoriteItems.length > 0 ? (
          <section className="organize-panel__group" aria-label="提问收藏">
            <h2 className="organize-panel__group-title">提问收藏</h2>
            <div className="folder-file-list organize-panel__list">
              {favoriteItems.map(item => {
                const checked = selected.has(item.key);
                return (
                  <article key={item.key} className="folder-file organize-panel__item">
                    <div className="organize-panel__item-row">
                      {viewingCard ? null : (
                        <label className="organize-panel__check organize-panel__check--item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleKey(item.key)}
                            onClick={event => event.stopPropagation()}
                            aria-label={`选择 ${item.favorite.text}`}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        className="folder-file__row organize-panel__item-main"
                        onClick={() => setSheetFavorite(item.favorite)}>
                        <span className="folder-file__body">
                          <span className="folder-file__title">{item.favorite.text}</span>
                          <span className="folder-file__meta">
                            {item.siteLabel} · {formatTime(item.favorite.updatedAt || item.favorite.createdAt)}
                          </span>
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && !summary.empty && !viewingCard ? (
          <div className="organize-panel__scroll-spacer" aria-hidden="true" />
        ) : null}
      </div>

      {!loading && !summary.empty && !viewingCard ? (
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
              onClick={() => void sendToMessages()}>
              {sending ? '整理中…' : '开始整理'}
            </button>
          </div>
        </footer>
      ) : null}

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
export type {
  OrganizeCardBrowseItem,
  OrganizeCardFavoriteItem,
  OrganizeCardPayload,
  OrganizeCardSiteInput,
} from './organize-card';
export {
  ORGANIZE_CARD_KIND,
  buildOrganizeCardFromSite,
  encodeOrganizeCard,
  organizeCardCountLabel,
  organizeCardLlmText,
  organizeCardPreview,
  parseOrganizeCard,
} from './organize-card';
