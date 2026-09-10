import { useConfirm } from '../../components/confirm-dialog';
import FolderCard from '../../components/folder-card';
import { useAppHeader } from '../../layouts';
import { formatChatDistance } from '../../lib/format-relative';
import {
  buildMessageSystemPrompt,
  buildOrganizeSystemPrompt,
  extractMemoryCandidates,
  formatMemoryBlock,
  ORGANIZE_AUTO_START_HINT,
  organizeCardLlmText,
  packChatHistoryForLlm,
  sliceOrganizeHistoryToCurrentBatch,
  stripMemoryForDisplay,
} from '../../lib/prompts';
import { useStickToBottomScroll } from '../../lib/use-stick-to-bottom-scroll';
import AskMarkdown from '../files-hub/ask-markdown';
import OrganizePanel, { organizeCardCountLabel, parseOrganizeCard } from '../organize';
import { callChatCompletion, callChatCompletionStream } from '../study/learning';
import {
  clipText,
  createPetChatThread,
  deletePetChatThread,
  getPetChatThread,
  listPetChatMessagesPage,
  listPetChatThreads,
  PetChatChannel,
  savePetChatMessage,
  savePetChatThread,
} from '@extension/knowledge-base';
import { useStorage } from '@extension/shared';
import {
  isLlmConfigured,
  llmSettingsStorage,
  memoryArchiveStorage,
  normalizeUserProfile,
  userProfileStorage,
} from '@extension/storage';
import { cn } from '@extension/ui';
import { ArrowUp, MessageSquarePlus, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OrganizeCardPayload } from '../organize';
import type { PetChatMessage, PetChatThread } from '@extension/knowledge-base';
import type { MouseEvent as ReactMouseEvent, UIEvent } from 'react';

type ChatSessionPanelProps = {
  isLight: boolean;
  onBack?: () => void;
  /** 会话通道，默认短信 */
  channel?: PetChatChannel;
  /** 嵌入文件中心等壳层时，列表态把顶栏交给外层 */
  embedded?: boolean;
  /** 进入后自动打开的会话 */
  initialThreadId?: string | null;
  /** 每次路由进入的去重键；变化时重新采纳 initialThreadId */
  initialThreadNonce?: string | null;
  /** 是否允许新建话题；整理通道默认不允许 */
  allowNewThread?: boolean;
  /** 列表态标题 */
  listTitle?: string;
};

type PetChatPanelProps = {
  isLight: boolean;
  onBack?: () => void;
};

const PAGE_SIZE = 20;
const TIME_GAP_MS = 5 * 60_000;

const shouldShowTimeLabel = (currentAt: number, previousAt?: number) =>
  previousAt == null || currentAt - previousAt >= TIME_GAP_MS;

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sanitizeTitle = (raw: string) => {
  const cleaned = raw
    .replace(/^["'「『《]+|["'」』》]+$/g, '')
    .replace(/[。！？.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clipText(cleaned, 12) || '新对话';
};

const ChatSessionPanel = ({
  isLight,
  onBack,
  channel = PetChatChannel.Message,
  embedded = false,
  initialThreadId = null,
  initialThreadNonce = null,
  allowNewThread,
  listTitle,
}: ChatSessionPanelProps) => {
  const confirm = useConfirm();
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const canCreateThread = allowNewThread ?? channel === PetChatChannel.Message;
  const panelTitle = listTitle ?? (channel === PetChatChannel.Organize ? '整理' : '短信');
  const welcomeText = profile.nickname
    ? `嗨，${profile.nickname}～我在这儿。想聊什么都可以跟我说。`
    : '嗨～我在这儿。想聊什么都可以跟我说。';

  const [threads, setThreads] = useState<PetChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<PetChatThread | null>(null);
  const [isDraftThread, setIsDraftThread] = useState(false);
  const [listBooting, setListBooting] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<PetChatMessage[]>([]);
  const [reviewCard, setReviewCard] = useState<OrganizeCardPayload | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [messagesReloadKey, setMessagesReloadKey] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipThreadLoadRef = useRef(false);
  const initialThreadConsumedRef = useRef<string | null>(null);
  const autoOrganizeReplyRef = useRef<string | null>(null);
  const streamRawRef = useRef('');
  const activeThreadId = activeThread?.id ?? null;
  const activeThreadIdRef = useRef<string | null>(null);
  const messagesRef = useRef<PetChatMessage[]>([]);
  const loadingRef = useRef(false);

  const {
    listRef,
    stickToBottomRef,
    pinToBottom,
    onScroll: onStickScroll,
    onWheel,
    onTouchMove,
  } = useStickToBottomScroll([messages, loading, streamingId, error, booting, activeThreadId]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshThreads = async () => {
    const next = await listPetChatThreads({ channel });
    // 未发过消息的空话题不展示，并清理掉
    const empty = next.filter(item => !item.preview.trim());
    if (empty.length > 0) {
      await Promise.all(empty.map(item => deletePetChatThread(item.id).catch(() => undefined)));
    }
    const visible = next.filter(item => item.preview.trim().length > 0);
    setThreads(visible);
    return visible;
  };

  useEffect(() => {
    let cancelled = false;
    setListBooting(true);
    void (async () => {
      try {
        await refreshThreads();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载话题失败');
        }
      } finally {
        if (!cancelled) {
          setListBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
    // channel 切换时重载列表
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshThreads closes over channel
  }, [channel]);

  useEffect(() => {
    if (!initialThreadId || listBooting) {
      return;
    }
    const consumeKey = `${initialThreadId}::${initialThreadNonce ?? ''}`;
    if (initialThreadConsumedRef.current === consumeKey) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const fromList = threads.find(item => item.id === initialThreadId);
      const thread = fromList ?? (await getPetChatThread(initialThreadId));
      if (cancelled) {
        return;
      }
      if (!thread || thread.channel !== channel) {
        // 消费掉无效 threadId，避免挡住整理通道的自动进会话
        initialThreadConsumedRef.current = consumeKey;
        return;
      }
      initialThreadConsumedRef.current = consumeKey;
      setError('');
      setInput('');
      setIsDraftThread(false);
      if (activeThreadIdRef.current === thread.id) {
        skipThreadLoadRef.current = false;
        setMessagesReloadKey(key => key + 1);
      }
      setActiveThread(thread);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialThreadId, initialThreadNonce, listBooting, threads, channel]);

  // 整理通道共用单一会话：有会话时直接进入，不停留在列表
  useEffect(() => {
    if (channel !== PetChatChannel.Organize || listBooting || activeThread || initialThreadId) {
      return;
    }
    if (threads[0]) {
      setError('');
      setInput('');
      setIsDraftThread(false);
      setActiveThread(threads[0]);
    }
  }, [channel, listBooting, threads, activeThread, initialThreadId]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      setHasMore(false);
      setBooting(false);
      return;
    }

    // 草稿会话尚未落库，不拉历史
    if (isDraftThread) {
      setMessages([]);
      setHasMore(false);
      setBooting(false);
      return;
    }

    // 草稿发出首条消息后升格为真实话题，避免重载冲掉正在流式输出的消息
    if (skipThreadLoadRef.current) {
      skipThreadLoadRef.current = false;
      setBooting(false);
      return;
    }

    let cancelled = false;
    setBooting(true);
    setError('');
    setMessages([]);
    pinToBottom();

    void (async () => {
      try {
        const page = await listPetChatMessagesPage({ threadId: activeThreadId, limit: PAGE_SIZE });
        if (cancelled || activeThreadIdRef.current !== activeThreadId) {
          return;
        }
        setMessages(page.messages);
        setHasMore(page.hasMore);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载聊天记录失败');
        }
      } finally {
        if (!cancelled && activeThreadIdRef.current === activeThreadId) {
          setBooting(false);
          pinToBottom();
        }
      }
    })();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [activeThreadId, isDraftThread, pinToBottom, messagesReloadKey]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 34), 120)}px`;
  }, [input]);

  const openThread = (thread: PetChatThread) => {
    setError('');
    setInput('');
    setIsDraftThread(false);
    setActiveThread(thread);
  };

  const backToList = async () => {
    abortRef.current?.abort();
    if (channel === PetChatChannel.Organize) {
      onBack?.();
      return;
    }
    setActiveThread(null);
    setIsDraftThread(false);
    setMessages([]);
    setError('');
    setInput('');
    try {
      await refreshThreads();
    } catch {
      /* ignore */
    }
  };

  const handleHeaderBack = () => {
    if (reviewCard) {
      setReviewCard(null);
      return;
    }
    if (activeThread) {
      void backToList();
      return;
    }
    onBack?.();
  };

  const startNewThread = () => {
    if (!canCreateThread) {
      return;
    }
    const now = Date.now();
    setError('');
    setInput('');
    setMessages([]);
    setHasMore(false);
    setBooting(false);
    setIsDraftThread(true);
    setActiveThread({
      id: createLocalId(),
      title: '新对话',
      titleStatus: 'pending',
      channel,
      preview: '',
      createdAt: now,
      updatedAt: now,
    });
    pinToBottom();
  };

  const removeThread = async (thread: PetChatThread, event: ReactMouseEvent) => {
    event.stopPropagation();
    const ok = await confirm({
      title: `删除话题「${thread.title}」？`,
      message: '聊天记录也会一起删除。',
      confirmLabel: '删除',
      cancelLabel: '取消',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }
    try {
      await deletePetChatThread(thread.id);
      if (activeThread?.id === thread.id) {
        setActiveThread(null);
        setIsDraftThread(false);
        setMessages([]);
      }
      await refreshThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const maybeSummarizeTitle = async (thread: PetChatThread, userText: string, assistantText: string) => {
    if (thread.titleStatus === 'ready') {
      return;
    }

    let title = sanitizeTitle(userText);
    if (isLlmConfigured(llm)) {
      try {
        const raw = await callChatCompletion(llm, [
          {
            role: 'system',
            content:
              '你是会话标题助手。根据对话用中文写一个不超过12个字的短标题，不要标点、不要引号、不要解释，只输出标题本身。',
          },
          {
            role: 'user',
            content: `用户：${userText.slice(0, 200)}\n助手：${assistantText.slice(0, 200)}`,
          },
        ]);
        title = sanitizeTitle(raw);
      } catch {
        /* 回退首句截断 */
      }
    }

    const updated = await savePetChatThread({
      id: thread.id,
      title,
      titleStatus: 'ready',
      preview: clipText(assistantText || userText, 40),
      createdAt: thread.createdAt,
    });

    if (activeThreadIdRef.current === thread.id) {
      setActiveThread(updated);
    }
    setThreads(prev => {
      const rest = prev.filter(item => item.id !== updated.id);
      return [updated, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const loadOlder = async () => {
    if (!activeThread || loadingMore || !hasMore || messages.length === 0) {
      return;
    }
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    const oldest = messages[0];
    if (!oldest) {
      return;
    }

    setLoadingMore(true);
    stickToBottomRef.current = false;
    try {
      const page = await listPetChatMessagesPage({
        threadId: activeThread.id,
        beforeCreatedAt: oldest.createdAt,
        limit: PAGE_SIZE,
      });
      setMessages(prev => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (!list) {
          return;
        }
        list.scrollTop = list.scrollHeight - prevHeight + prevTop;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载更早消息失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const onListScroll = (event?: UIEvent<HTMLDivElement>) => {
    onStickScroll(event);
    const el = listRef.current;
    if (!el) {
      return;
    }
    if (el.scrollTop < 48) {
      void loadOlder();
    }
  };

  const systemPromptFor = async (forOrganizeAuto = false) => {
    const memoryItems = await memoryArchiveStorage.listForPrompt({
      channel: channel === PetChatChannel.Organize ? 'organize' : 'message',
      limit: 20,
    });
    const memoryBlock = formatMemoryBlock(
      memoryItems.map(item => ({
        id: item.id,
        channel: item.channel,
        fact: item.fact,
        threadId: item.threadId,
        createdAt: item.createdAt,
        confidence: item.confidence,
      })),
    );

    if (channel === PetChatChannel.Organize) {
      const base = buildOrganizeSystemPrompt(profile, { memoryBlock });
      return forOrganizeAuto ? `${base}\n\n${ORGANIZE_AUTO_START_HINT}` : base;
    }
    return buildMessageSystemPrompt(profile, { memoryBlock });
  };

  const mapMessageContentForLlm = (content: string) => {
    const card = parseOrganizeCard(content);
    return card ? organizeCardLlmText(card) : content;
  };

  /** 针对已有用户消息（含整理卡片）生成助手回复，不重复落库用户消息 */
  const runAssistantReply = async (
    thread: PetChatThread,
    userMessage: PetChatMessage,
    options?: { organizeAuto?: boolean },
  ) => {
    if (loadingRef.current) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      setError('还没配置模型，请先在设置里填写 API Key');
      return;
    }

    const assistantId = createLocalId();
    const assistantMsg: PetChatMessage = {
      id: assistantId,
      threadId: thread.id,
      role: 'assistant',
      content: '',
      createdAt: Math.max(Date.now(), userMessage.createdAt + 1),
    };

    setError('');
    pinToBottom();
    streamRawRef.current = '';
    setMessages(prev => [...prev, assistantMsg]);
    setStreamingId(assistantId);
    setLoading(true);

    try {
      const historyTurns = [
        ...messagesRef.current.filter(item => item.id !== assistantId && item.id !== userMessage.id),
        userMessage,
      ].map(item => ({ role: item.role, content: item.content }));

      const scopedTurns =
        channel === PetChatChannel.Organize ? sliceOrganizeHistoryToCurrentBatch(historyTurns) : historyTurns;

      const packed = packChatHistoryForLlm(scopedTurns, {
        maxTurns: channel === PetChatChannel.Organize ? 20 : 12,
        mapContent: content => mapMessageContentForLlm(content),
      });

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const systemPrompt = await systemPromptFor(Boolean(options?.organizeAuto));
      const full = await callChatCompletionStream(
        llm,
        [{ role: 'system', content: systemPrompt }, ...packed],
        chunk => {
          streamRawRef.current += chunk;
          const visible = stripMemoryForDisplay(streamRawRef.current);
          setMessages(prev => prev.map(item => (item.id === assistantId ? { ...item, content: visible } : item)));
        },
        controller.signal,
      );

      const rawText = full.trim() || '（我这边没想好，再说一次？）';
      const memoryFacts = extractMemoryCandidates(rawText);
      const finalText = stripMemoryForDisplay(rawText) || '（我这边没想好，再说一次？）';
      const saved = await savePetChatMessage({
        id: assistantId,
        threadId: thread.id,
        role: 'assistant',
        content: finalText,
        createdAt: assistantMsg.createdAt,
      });
      setMessages(prev => prev.map(item => (item.id === assistantId ? saved : item)));

      if (memoryFacts.length > 0) {
        void memoryArchiveStorage
          .appendFacts(memoryFacts, {
            channel: channel === PetChatChannel.Organize ? 'organize' : 'message',
            threadId: thread.id,
            confidence: channel === PetChatChannel.Organize ? 'confirmed' : 'candidate',
          })
          .catch(() => undefined);
      }

      if (channel !== PetChatChannel.Organize) {
        const seed = mapMessageContentForLlm(userMessage.content);
        void maybeSummarizeTitle(thread, seed.slice(0, 200), finalText);
      } else {
        await refreshThreads().catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setMessages(prev => prev.filter(item => item.id !== assistantId || item.content.trim()));
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setStreamingId(null);
      setLoading(false);
    }
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading || !activeThread) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      setError('还没配置模型，请先在设置里填写 API Key');
      return;
    }

    let thread = activeThread;
    // 草稿会话：发出第一条消息时才真正建话题
    if (isDraftThread) {
      try {
        thread = await createPetChatThread('新对话', { channel });
        skipThreadLoadRef.current = true;
        setIsDraftThread(false);
        setActiveThread(thread);
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建话题失败');
        return;
      }
    }

    const now = Date.now();
    const userMsg: PetChatMessage = {
      id: createLocalId(),
      threadId: thread.id,
      role: 'user',
      content: text,
      createdAt: now,
    };

    setInput('');
    setMessages(prev => [...prev, userMsg]);
    try {
      await savePetChatMessage(userMsg);
      await runAssistantReply(thread, userMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    }
  };

  // 整理卡片发出后：若最新一条是未回复的整理卡，自动开始整理
  useEffect(() => {
    if (channel !== PetChatChannel.Organize || !activeThread || isDraftThread || booting || loading) {
      return;
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || !parseOrganizeCard(last.content)) {
      return;
    }
    if (autoOrganizeReplyRef.current === last.id) {
      return;
    }
    autoOrganizeReplyRef.current = last.id;
    void runAssistantReply(activeThread, last, { organizeAuto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在消息末尾出现未回复整理卡时触发
  }, [channel, activeThread, isDraftThread, booting, loading, messages]);

  const canSend = Boolean(input.trim()) && !loading && Boolean(activeThread);
  const showWelcome = Boolean(activeThread) && !booting && channel === PetChatChannel.Message;

  const headerTitle = reviewCard ? '资料详情' : activeThread?.title || panelTitle;
  const headerSyncKey = reviewCard ? 'detail' : activeThread ? `chat:${activeThread.id}` : 'list';
  const headerOwnsChrome =
    !embedded || Boolean(activeThread) || Boolean(reviewCard) || channel === PetChatChannel.Organize;
  useAppHeader(headerTitle, {
    onBack: handleHeaderBack,
    syncKey: headerSyncKey,
    enabled: headerOwnsChrome,
    trailing:
      !reviewCard && !activeThread && canCreateThread ? (
        <button type="button" className="pet-chat__topic-new" onClick={startNewThread}>
          <MessageSquarePlus size={16} strokeWidth={2.2} />
          新话题
        </button>
      ) : undefined,
  });

  if (reviewCard) {
    return <OrganizePanel isLight={isLight} readOnly card={reviewCard} onBack={() => setReviewCard(null)} hideChrome />;
  }

  if (!activeThread) {
    return (
      <div className={cn('sm-shell pet-chat', embedded && 'pet-chat--embedded', !isLight && 'sm-shell--dark')}>
        <div className="pet-chat__threads">
          {listBooting ? <p className="pet-chat__load-more">加载中…</p> : null}
          {!listBooting && threads.length === 0 ? (
            <div className="pet-chat__threads-empty">
              {channel === PetChatChannel.Organize ? (
                <>
                  <p>还没有整理会话</p>
                  <p className="pet-chat__threads-empty-hint">在「文件 · 专注」加入整理后会出现在这里</p>
                </>
              ) : (
                <>
                  <p>还没有话题</p>
                  {canCreateThread ? (
                    <button
                      type="button"
                      className="pet-chat__topic-new pet-chat__topic-new--block"
                      onClick={startNewThread}>
                      开始新话题
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          {threads.map(thread => (
            <div
              key={thread.id}
              className="pet-chat__thread"
              role="button"
              tabIndex={0}
              onClick={() => openThread(thread)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openThread(thread);
                }
              }}>
              <div className="pet-chat__thread-top">
                <span className="pet-chat__thread-name">{thread.title}</span>
                <span className="pet-chat__thread-meta">
                  <span className="pet-chat__thread-time">{formatChatDistance(thread.updatedAt, nowTick)}</span>
                  <button
                    type="button"
                    className="pet-chat__thread-delete"
                    aria-label={`删除 ${thread.title}`}
                    onClick={event => void removeThread(thread, event)}>
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </span>
              </div>
              <p className="pet-chat__thread-preview">{thread.preview || '暂无消息'}</p>
            </div>
          ))}
          {error ? <p className="pet-chat__error-text pet-chat__threads-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('sm-shell pet-chat', embedded && 'pet-chat--embedded', !isLight && 'sm-shell--dark')}>
      <div className="pet-chat__list" ref={listRef} onScroll={onListScroll} onWheel={onWheel} onTouchMove={onTouchMove}>
        {loadingMore ? <p className="pet-chat__load-more">加载更早消息…</p> : null}
        {hasMore && !loadingMore ? (
          <p className="pet-chat__load-more pet-chat__load-more--hint">上滑加载更早消息</p>
        ) : null}

        {booting ? <p className="pet-chat__load-more">加载中…</p> : null}

        {showWelcome ? (
          <div className="pet-chat__row pet-chat__row--pet">
            <div className="pet-chat__bubble pet-chat__bubble--pet">
              <p className="pet-chat__text">{welcomeText}</p>
            </div>
          </div>
        ) : null}

        {messages.map((msg, index) => {
          const prev = messages[index - 1];
          const showTime = shouldShowTimeLabel(msg.createdAt, prev?.createdAt);
          const organizeCard = parseOrganizeCard(msg.content);
          return (
            <div key={msg.id} className="pet-chat__block">
              {showTime ? (
                <p className="pet-chat__time" title={new Date(msg.createdAt).toLocaleString()}>
                  {formatChatDistance(msg.createdAt, nowTick)}
                </p>
              ) : null}
              <div className={cn('pet-chat__row', msg.role === 'user' ? 'pet-chat__row--user' : 'pet-chat__row--pet')}>
                {organizeCard ? (
                  <FolderCard
                    className="folder-card--chat"
                    title="文件"
                    subtitle={organizeCard.dayLabel}
                    countLabel={organizeCardCountLabel(organizeCard)}
                    sheetCount={organizeCard.browse.length + organizeCard.favorites.length}
                    favoriteMark={organizeCard.favorites.length > 0}
                    accent="rose"
                    onOpen={() => setReviewCard(organizeCard)}
                  />
                ) : (
                  <div
                    className={cn(
                      'pet-chat__bubble',
                      msg.role === 'user' ? 'pet-chat__bubble--user' : 'pet-chat__bubble--pet',
                      streamingId === msg.id && 'pet-chat__bubble--streaming',
                    )}>
                    {msg.role === 'assistant' ? (
                      <AskMarkdown content={stripMemoryForDisplay(msg.content)} streaming={streamingId === msg.id} />
                    ) : (
                      <p className="pet-chat__text">{msg.content}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && !streamingId ? (
          <div className="pet-chat__row pet-chat__row--pet">
            <div className="pet-chat__bubble pet-chat__bubble--pet pet-chat__bubble--typing" aria-label="对方正在输入">
              <span className="pet-chat__dot" />
              <span className="pet-chat__dot" />
              <span className="pet-chat__dot" />
            </div>
          </div>
        ) : null}
      </div>

      <footer className="pet-chat__footer">
        {error ? (
          <div className="pet-chat__error">
            <p className="pet-chat__error-text">{error}</p>
            {!isLlmConfigured(llm) ? (
              <button
                type="button"
                className="pet-chat__error-link"
                onClick={() => void chrome.runtime.openOptionsPage()}>
                去设置
              </button>
            ) : null}
          </div>
        ) : null}

        <form
          className="pet-chat__composer"
          onSubmit={event => {
            event.preventDefault();
            void sendText(input);
          }}>
          <div className="pet-chat__input-shell">
            <textarea
              ref={inputRef}
              className="pet-chat__input"
              rows={1}
              value={input}
              placeholder="发消息…"
              disabled={loading}
              onChange={event => {
                setInput(event.target.value);
                if (error) {
                  setError('');
                }
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendText(input);
                }
              }}
            />
            <button
              type="submit"
              className={cn('pet-chat__send', canSend && 'pet-chat__send--active')}
              disabled={!canSend}
              aria-label="发送">
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
};

const PetChatPanel = ({ isLight, onBack }: PetChatPanelProps) => (
  <ChatSessionPanel isLight={isLight} onBack={onBack} channel={PetChatChannel.Message} />
);

export default PetChatPanel;
export { ChatSessionPanel };
export type { ChatSessionPanelProps, PetChatPanelProps };
