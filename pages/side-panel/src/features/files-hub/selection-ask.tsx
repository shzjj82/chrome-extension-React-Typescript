import { extractLinksFromAnswer } from './ask-links';
import { buildAskSystemPrompt, INITIAL_ASK_USER_PROMPT, createLocalId } from './ask-prompt';
import { applyStreamChunk, createRevealReservoir, finalizeStreamReveal } from './ask-stream-reveal';
import AskTab from './ask-tab';
import { toLocalDateKey } from './browse-day-calendar';
import FavoriteSheet from './favorite-sheet';
import FavoritesTab from './favorites-tab';
import { deleteSelectionFavorite, listSelectionFavorites, saveSelectionFavorite } from '@extension/knowledge-base';
import { useStorage } from '@extension/shared';
import {
  isLlmConfigured,
  llmSettingsStorage,
  normalizeUserProfile,
  selectionAskDraftStorage,
  selectionAskSessionStorage,
  userProfileStorage,
} from '@extension/storage';
import { SegmentedSwitch, cn } from '@extension/ui';
import BackIconButton from '@src/components/back-icon-button';
import { useConfirm } from '@src/components/confirm-dialog';
import PhoneStatusBar from '@src/components/phone-status-bar';
import { callChatCompletionStream } from '@src/features/study/learning';
import { useStickToBottomScroll } from '@src/lib/use-stick-to-bottom-scroll';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AskLink } from './ask-links';
import type { AskMessage } from './ask-tab';
import type { SelectionFavorite } from '@extension/knowledge-base';

type SelectionAskPanelProps = {
  isLight: boolean;
  onBack?: () => void;
  /** 嵌入文件 Hub：不渲染状态栏与顶部分段 */
  embedded?: boolean;
  /** 嵌入时由 Hub 控制当前子页 */
  embeddedTab?: 'ask' | 'favorites';
  /** 收藏列表按本地日过滤（提问页不传） */
  filterDateKey?: string;
  /** 嵌入时出现新划选草稿时通知 Hub 切到提问 */
  onRequestAskTab?: () => void;
  onFavoritesRefreshReady?: (refresh: () => Promise<void>) => void;
  onFavoriteDateKeysChange?: (keys: Set<string>) => void;
  onFilteredFavoritesCountChange?: (count: number) => void;
  /** 收藏列表变更后通知 Hub（专注夹内同步） */
  onFavoritesUpdated?: () => void;
};

const SelectionAskPanel = ({
  isLight,
  onBack,
  embedded = false,
  embeddedTab,
  filterDateKey,
  onRequestAskTab,
  onFavoritesRefreshReady,
  onFavoriteDateKeysChange,
  onFilteredFavoritesCountChange,
  onFavoritesUpdated,
}: SelectionAskPanelProps) => {
  const confirm = useConfirm();
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const draft = useStorage(selectionAskDraftStorage);

  const [tabState, setTabState] = useState<'ask' | 'favorites'>(draft?.text ? 'ask' : 'favorites');
  const tab = embedded && embeddedTab ? embeddedTab : tabState;
  const setTab = (next: 'ask' | 'favorites') => {
    if (embedded) {
      if (next === 'ask') {
        onRequestAskTab?.();
      }
      return;
    }
    setTabState(next);
  };
  const [sourceExpanded, setSourceExpanded] = useState(true);
  const [favorites, setFavorites] = useState<SelectionFavorite[]>([]);
  const syncFavorites = useCallback(async () => {
    const items = await listSelectionFavorites();
    setFavorites(items);
    onFavoritesUpdated?.();
    return items;
  }, [onFavoritesUpdated]);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [sheetFavorite, setSheetFavorite] = useState<SelectionFavorite | null>(null);
  const [loading, setLoading] = useState(false);
  /** 等待首字吐出前为 true：只展示 loading，不展示空回复/输入框 */
  const [pendingFirstToken, setPendingFirstToken] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [links, setLinks] = useState<AskLink[]>([]);
  const [input, setInput] = useState('');
  const [askedKey, setAskedKey] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const revealRef = useRef(createRevealReservoir());
  const restoreFavoriteRef = useRef<{
    messages: AskMessage[];
    links: AskLink[];
    favoriteId: string;
    createdAt: number;
  } | null>(null);
  const favoriteCreatedAtRef = useRef<number | null>(null);

  const { listRef, pinToBottom, onScroll, onWheel, onTouchMove } = useStickToBottomScroll([
    messages,
    loading,
    pendingFirstToken,
    streamingId,
    error,
    links,
  ]);

  const draftKey = useMemo(() => (draft ? `${draft.createdAt}:${draft.text.slice(0, 40)}` : ''), [draft]);
  const visibleMessages = useMemo(
    () => messages.filter(msg => !msg.hidden && msg.content.trim().length > 0),
    [messages],
  );
  const visibleFavorites = useMemo(() => {
    if (!filterDateKey) {
      return favorites;
    }
    return favorites.filter(item => toLocalDateKey(new Date(item.createdAt)) === filterDateKey);
  }, [favorites, filterDateKey]);
  const showComposer =
    Boolean(draft?.text) && !pendingFirstToken && !error && (visibleMessages.length > 0 || askedKey === draftKey);

  useEffect(() => {
    if (!onFavoriteDateKeysChange) {
      return;
    }
    const keys = new Set(favorites.map(item => toLocalDateKey(new Date(item.createdAt))));
    onFavoriteDateKeysChange(keys);
  }, [favorites, onFavoriteDateKeysChange]);

  useEffect(() => {
    onFilteredFavoritesCountChange?.(visibleFavorites.length);
  }, [visibleFavorites.length, onFilteredFavoritesCountChange]);

  useEffect(() => {
    if (!draftKey) {
      return;
    }

    let cancelled = false;
    abortRef.current?.abort();
    setTab('ask');
    setError('');
    setInput('');
    setStreamingId(null);
    setLoading(false);
    setPendingFirstToken(false);
    setSourceExpanded(true);

    const restore = restoreFavoriteRef.current;
    if (restore) {
      restoreFavoriteRef.current = null;
      setMessages(restore.messages);
      setLinks(restore.links);
      setFavoriteId(restore.favoriteId);
      favoriteCreatedAtRef.current = restore.createdAt;
      setAskedKey(draftKey);
      pinToBottom();
      void selectionAskSessionStorage.set({
        draftKey,
        askedKey: draftKey,
        messages: restore.messages,
        links: restore.links,
        favoriteId: restore.favoriteId,
        favoriteCreatedAt: restore.createdAt,
      });
      return;
    }

    void (async () => {
      const cached = await selectionAskSessionStorage.get();
      if (cancelled) {
        return;
      }

      const hasCachedAnswer =
        cached?.draftKey === draftKey &&
        cached.askedKey === draftKey &&
        cached.messages.some(msg => msg.role === 'assistant' && msg.content.trim().length > 0);

      if (hasCachedAnswer && cached) {
        setMessages(cached.messages);
        setLinks(cached.links ?? []);
        setFavoriteId(cached.favoriteId);
        favoriteCreatedAtRef.current = cached.favoriteCreatedAt;
        setAskedKey(cached.askedKey);
        pinToBottom();
        return;
      }

      setMessages([]);
      setLinks([]);
      setAskedKey('');
      setFavoriteId(null);
      favoriteCreatedAtRef.current = null;
      pinToBottom();

      if (cancelled) {
        return;
      }
      if (!isLlmConfigured(llm)) {
        return;
      }
      // 新划选：只在这里发起首轮，避免与下方 effect 竞态导致重复请求
      void sendFollowUp(INITIAL_ASK_USER_PROMPT, { initial: true, hideUser: true });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    let cancelled = false;
    const refreshFavorites = async () => {
      try {
        // 一次性把旧 chrome.storage 收藏迁到 IndexedDB
        const legacy = await chrome.storage.local.get('selection-favorites');
        const legacyItems = (legacy['selection-favorites'] as { items?: SelectionFavorite[] } | undefined)?.items;
        if (Array.isArray(legacyItems) && legacyItems.length > 0) {
          for (const item of legacyItems) {
            if (!item?.text?.trim()) {
              continue;
            }
            await saveSelectionFavorite({
              id: item.id,
              text: item.text,
              sourceUrl: item.sourceUrl || '',
              pageTitle: item.pageTitle || '',
              createdAt: item.createdAt,
              messages: item.messages,
              links: item.links,
            });
          }
          await chrome.storage.local.remove('selection-favorites');
        }

        if (!cancelled) {
          await syncFavorites();
        }
      } catch {
        if (!cancelled) {
          setFavorites([]);
        }
      }
    };
    onFavoritesRefreshReady?.(refreshFavorites);
    void refreshFavorites();
    return () => {
      cancelled = true;
    };
  }, [tab, onFavoritesRefreshReady, onFavoritesUpdated, syncFavorites]);

  /** 已收藏的提问：后续解答/追问/链接持续同步到同一条收藏 */
  useEffect(() => {
    if (!favoriteId || !draft?.text) {
      return;
    }
    if (loading || pendingFirstToken || streamingId) {
      return;
    }

    let cancelled = false;
    const createdAt = favoriteCreatedAtRef.current ?? Date.now();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const saved = await saveSelectionFavorite({
            id: favoriteId,
            createdAt,
            text: draft.text,
            sourceUrl: draft.sourceUrl,
            pageTitle: draft.pageTitle,
            messages: messages
              .filter(msg => msg.content.trim().length > 0)
              .map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                hidden: msg.hidden,
              })),
            links,
          });
          if (!cancelled) {
            favoriteCreatedAtRef.current = saved.createdAt;
            await syncFavorites();
          }
        } catch {
          // 同步失败不打断提问
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    favoriteId,
    draft?.text,
    draft?.sourceUrl,
    draft?.pageTitle,
    messages,
    links,
    loading,
    pendingFirstToken,
    streamingId,
    syncFavorites,
  ]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 34), 120)}px`;
  }, [input, showComposer]);

  const sendFollowUp = async (raw: string, options?: { initial?: boolean; hideUser?: boolean }) => {
    const text = raw.trim();
    if (!draft?.text || !text || loading) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      setError('还没配置模型，请先在设置里填写 API Key');
      return;
    }

    const userMsg: AskMessage = {
      id: createLocalId(),
      role: 'user',
      content: text,
      hidden: Boolean(options?.hideUser),
    };
    const assistantId = createLocalId();
    const assistantMsg: AskMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };

    const history = options?.initial ? [userMsg] : [...messages, userMsg];
    revealRef.current = createRevealReservoir();
    setInput('');
    setError('');
    setLinks([]);
    pinToBottom();
    setMessages(history);
    setStreamingId(null);
    setPendingFirstToken(true);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const applyAssistantText = (text: string, asStreaming: boolean) => {
      if (asStreaming) {
        setPendingFirstToken(false);
        setStreamingId(assistantId);
      }
      setMessages(prev => {
        if (prev.some(item => item.id === assistantId)) {
          return prev.map(item => (item.id === assistantId ? { ...item, content: text } : item));
        }
        return [...prev, { ...assistantMsg, content: text }];
      });
    };

    try {
      const full = await callChatCompletionStream(
        llm,
        [
          {
            role: 'system',
            content: buildAskSystemPrompt(profile, draft.text, draft.pageTitle, draft.sourceUrl),
          },
          ...history.map(item => ({ role: item.role, content: item.content })),
        ],
        chunk => {
          const result = applyStreamChunk(revealRef.current, chunk);
          revealRef.current = result.state;
          if (result.type === 'reveal') {
            applyAssistantText(result.text, true);
            return;
          }
          if (result.type === 'append') {
            setMessages(prev =>
              prev.map(item =>
                item.id === assistantId ? { ...item, content: `${item.content}${result.chunk}` } : item,
              ),
            );
          }
        },
        controller.signal,
      );

      const finalized = finalizeStreamReveal(revealRef.current, full);
      revealRef.current = finalized.state;
      if (finalized.needReveal) {
        applyAssistantText(finalized.revealText, true);
      }
      setPendingFirstToken(false);
      applyAssistantText(finalized.finalText, false);
      setLinks(extractLinksFromAnswer(finalized.finalText, draft.text, draft.sourceUrl));
      if (options?.initial) {
        setAskedKey(draftKey);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setPendingFirstToken(false);
      setMessages(prev => prev.filter(item => item.id !== assistantId || item.content.trim()));
      setError(err instanceof Error ? err.message : '提问失败');
    } finally {
      setStreamingId(null);
      setLoading(false);
      setPendingFirstToken(false);
    }
  };

  // 会话落盘：切 Tab / 离开再进入时直接恢复，不重复打模型
  useEffect(() => {
    if (!draftKey || askedKey !== draftKey) {
      return;
    }
    if (loading || pendingFirstToken || streamingId) {
      return;
    }
    const hasAnswer = messages.some(msg => msg.role === 'assistant' && msg.content.trim().length > 0);
    if (!hasAnswer) {
      return;
    }
    void selectionAskSessionStorage.set({
      draftKey,
      askedKey,
      messages,
      links,
      favoriteId,
      favoriteCreatedAt: favoriteCreatedAtRef.current,
    });
  }, [draftKey, askedKey, messages, links, favoriteId, loading, pendingFirstToken, streamingId]);

  const saveCurrent = async () => {
    if (!draft?.text) {
      return;
    }
    try {
      if (favoriteId) {
        await deleteSelectionFavorite(favoriteId);
        setFavoriteId(null);
        favoriteCreatedAtRef.current = null;
        await syncFavorites();
        return;
      }
      const saved = await saveSelectionFavorite({
        text: draft.text,
        sourceUrl: draft.sourceUrl,
        pageTitle: draft.pageTitle,
        messages: messages
          .filter(msg => msg.content.trim().length > 0)
          .map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            hidden: msg.hidden,
          })),
        links,
      });
      favoriteCreatedAtRef.current = saved.createdAt;
      setFavoriteId(saved.id);
      await syncFavorites();
    } catch (err) {
      setError(err instanceof Error ? err.message : '收藏失败');
    }
  };

  const openFavoriteSheet = (item: SelectionFavorite) => {
    setSheetFavorite(item);
  };

  const continueFavoriteInAsk = async (item: SelectionFavorite) => {
    const hasCurrentAsk =
      Boolean(draft?.text?.trim()) ||
      visibleMessages.length > 0 ||
      loading ||
      pendingFirstToken ||
      Boolean(streamingId);
    const alreadyThisFavorite = favoriteId === item.id && draft?.text === item.text;

    if (hasCurrentAsk && !alreadyThisFavorite) {
      const ok = await confirm({
        title: '覆盖当前提问？',
        message: '继续后，当前对话会被这条收藏替换。',
        confirmLabel: '继续',
        cancelLabel: '取消',
        tone: 'default',
      });
      if (!ok) {
        return;
      }
    }

    restoreFavoriteRef.current = {
      favoriteId: item.id,
      createdAt: item.createdAt,
      links: item.links ?? [],
      messages: (item.messages ?? []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        hidden: msg.hidden,
      })),
    };
    setSheetFavorite(null);
    void selectionAskDraftStorage.set({
      text: item.text,
      sourceUrl: item.sourceUrl,
      pageTitle: item.pageTitle,
      createdAt: Date.now(),
    });
    setTab('ask');
  };

  const formatFavoriteTime = (at: number) => {
    const date = new Date(at);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  };

  const canSend = Boolean(input.trim()) && !loading && Boolean(draft?.text) && isLlmConfigured(llm);

  return (
    <div
      className={cn(
        'side-panel sm-shell selection-ask',
        embedded && 'selection-ask--embedded',
        !isLight && 'sm-shell--dark',
      )}>
      {embedded ? null : <PhoneStatusBar className="selection-ask__status" clockLeft />}

      {embedded ? null : (
        <div className="selection-ask__header">
          {onBack ? (
            <BackIconButton className="selection-ask__back" iconSize={16} onClick={onBack} />
          ) : (
            <span className="selection-ask__header-spacer" />
          )}
          <h1 className="selection-ask__title">{tab === 'ask' ? '提问' : '收藏'}</h1>
          <SegmentedSwitch
            aria-label="提问与收藏切换"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'ask', label: '提问' },
              { value: 'favorites', label: '收藏' },
            ]}
          />
        </div>
      )}

      {tab === 'ask' ? (
        <AskTab
          draft={draft}
          sourceExpanded={sourceExpanded}
          onToggleSource={() => setSourceExpanded(prev => !prev)}
          favoriteId={favoriteId}
          onSaveFavorite={() => void saveCurrent()}
          messages={visibleMessages}
          links={links}
          pendingFirstToken={pendingFirstToken}
          streamingId={streamingId}
          error={error}
          llmConfigured={isLlmConfigured(llm)}
          showComposer={showComposer}
          input={input}
          onInputChange={setInput}
          onClearError={() => setError('')}
          onSend={text => void sendFollowUp(text)}
          onRetryInitial={() =>
            void sendFollowUp(INITIAL_ASK_USER_PROMPT, {
              initial: true,
              hideUser: true,
            })
          }
          onOpenOptions={() => void chrome.runtime.openOptionsPage()}
          canSend={canSend}
          loading={loading}
          listRef={listRef}
          onScroll={onScroll}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          inputRef={inputRef}
        />
      ) : (
        <FavoritesTab
          favoritesTotal={favorites.length}
          items={visibleFavorites}
          onGoAsk={() => setTab('ask')}
          onOpen={openFavoriteSheet}
          onDelete={item => {
            void (async () => {
              const ok = await confirm({
                title: '删除这条收藏？',
                message: '删除后无法恢复。',
                confirmLabel: '删除',
                cancelLabel: '取消',
                tone: 'danger',
              });
              if (!ok) {
                return;
              }
              await deleteSelectionFavorite(item.id);
              await syncFavorites();
              if (favoriteId === item.id) {
                setFavoriteId(null);
                favoriteCreatedAtRef.current = null;
              }
              if (sheetFavorite?.id === item.id) {
                setSheetFavorite(null);
              }
            })();
          }}
          formatTime={formatFavoriteTime}
        />
      )}

      <FavoriteSheet
        favorite={sheetFavorite}
        isLight={isLight}
        onClose={() => setSheetFavorite(null)}
        footer={
          sheetFavorite ? (
            <button
              type="button"
              className="selection-ask__fav-continue"
              onClick={() => continueFavoriteInAsk(sheetFavorite)}>
              继续提问
            </button>
          ) : null
        }
      />
    </div>
  );
};

export default SelectionAskPanel;
