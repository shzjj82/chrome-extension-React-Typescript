import BackIconButton from './BackIconButton';
import { toLocalDateKey } from './BrowseDayCalendar';
import { callChatCompletionStream } from './lib/learning';
import { useStickToBottomScroll } from './lib/useStickToBottomScroll';
import PhoneStatusBar from './PhoneStatusBar';
import SheetFrame from './SheetFrame';
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
import { ArrowUp, Bookmark, BookmarkCheck, ChevronDown, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SelectionFavorite } from '@extension/knowledge-base';
import type { LearningGoal, KnowledgeDepth, UserProfileType } from '@extension/storage';

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
};

type AskLink = {
  title: string;
  url: string;
};

type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** 首轮引导提问不展示 */
  hidden?: boolean;
};

const goalLabel = (goal: LearningGoal) => {
  if (goal === 'principle') {
    return '偏原理理解';
  }
  if (goal === 'exam') {
    return '偏考试应试';
  }
  return '偏落地应用';
};

const depthLabel = (depth: KnowledgeDepth) => {
  if (depth === 'shallow') {
    return '浅层概览';
  }
  if (depth === 'deep') {
    return '深入细节';
  }
  return '适中深度';
};

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ask-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const searchUrl = (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

const isJunkLinkTitle = (title: string) => {
  const s = title.trim().toLowerCase();
  if (!s || s.length < 2) {
    return true;
  }
  if (/^[-–—_*|=.\s]+$/.test(s)) {
    return true;
  }
  if (['link', 'url', 'http', 'https', 'www', '相关查询', '相关链接', '参考链接'].includes(s)) {
    return true;
  }
  if (/^(link|url)\b/.test(s) && s.length <= 8) {
    return true;
  }
  return false;
};

const isValidHttpUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const buildFallbackLinks = (text: string, sourceUrl: string): AskLink[] => {
  const q = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  const links: AskLink[] = [];
  if (sourceUrl && isValidHttpUrl(sourceUrl)) {
    links.push({ title: '来源页面', url: sourceUrl });
  }
  if (q) {
    links.push({ title: `搜索：${q.slice(0, 24)}${q.length > 24 ? '…' : ''}`, url: searchUrl(q) });
  }
  return links;
};

const splitAnswerSections = (answer: string) => {
  const match = answer.match(
    /^(?:([\s\S]*?)\n)?(?:#{0,3}\s*)?(相关查询|相关链接|参考链接|延伸阅读)[：:]\s*\n([\s\S]*)$/i,
  );
  if (!match) {
    return { body: answer.trim(), linkBlock: '' };
  }
  return {
    body: (match[1] || '').trim(),
    linkBlock: (match[3] || '').trim(),
  };
};

const extractLinksFromAnswer = (answer: string, selection: string, sourceUrl: string): AskLink[] => {
  const { linkBlock } = splitAnswerSections(answer);
  const source = linkBlock || answer;
  const links: AskLink[] = [];
  const seen = new Set<string>();

  const push = (title: string, url: string) => {
    const cleanTitle = title.replace(/^[-*•\d.)\s]+/, '').trim();
    if (isJunkLinkTitle(cleanTitle) || !isValidHttpUrl(url) || seen.has(url)) {
      return;
    }
    seen.add(url);
    links.push({ title: cleanTitle, url });
  };

  for (const match of source.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    push(match[1], match[2]);
  }

  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^[-–—_*|=.\s]{2,}$/.test(trimmed)) {
      continue;
    }
    const md = trimmed.match(/^[-*•]\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (md) {
      push(md[1], md[2]);
      continue;
    }
    const pipe = trimmed.match(/^[-*•]?\s*(.+?)\s*[|｜]\s*(.+)$/);
    if (pipe) {
      const left = pipe[1].trim();
      const right = pipe[2].trim();
      if (right.startsWith('http') && isValidHttpUrl(right)) {
        push(left, right);
      } else if (right && !isJunkLinkTitle(right) && right.length >= 2 && right.length <= 60) {
        push(left || right, searchUrl(right));
      }
      continue;
    }
    const plain = trimmed.match(/^[-*•]\s+(.+)$/);
    if (plain && linkBlock) {
      const item = plain[1].trim();
      if (item.startsWith('http') && isValidHttpUrl(item)) {
        push(item, item);
      } else if (!isJunkLinkTitle(item) && item.length >= 2 && item.length <= 40 && !item.includes('**')) {
        push(item, searchUrl(item));
      }
    }
  }

  if (links.length === 0) {
    return buildFallbackLinks(selection, sourceUrl);
  }
  return links.slice(0, 6);
};

const displayAnswerBody = (answer: string) => {
  const { body, linkBlock } = splitAnswerSections(answer);
  return (body || (linkBlock ? '' : answer)).trim();
};

const buildAskSystemPrompt = (profile: UserProfileType, text: string, pageTitle: string, sourceUrl: string) => {
  const name = profile.nickname.trim() || '学习者';
  const occupation = profile.occupation.trim() || '学习者';
  const domains = profile.domains.trim() || '未填写';
  const goal = goalLabel(profile.goal);
  const depth = depthLabel(profile.depth);

  return [
    '你是 Study Mind 的学习提问助手，帮助用户读懂并消化网页划选内容。',
    '',
    '【优先级，必须遵守】',
    '1. 第一优先：紧扣「当前文章」做分析——以页面标题、链接与划选原文为依据，先弄清原文在说什么、关键事实/概念/论证是什么；不得脱离原文空谈，不得用身份偏见歪曲原文。',
    '2. 第二优先：在原文分析成立之后，再结合用户身份与职业视角给出观点与落地建议。',
    '',
    '【用户档案】',
    `称呼：${name}`,
    `职业：${occupation}`,
    `关注领域：${domains}`,
    `学习目标：${goal}`,
    `讲解深度：${depth}`,
    '',
    '【回答策略】',
    `- 先做原文拆解：这段划选在文章语境里指什么、为何重要、有无前提/歧义/待核实点。`,
    `- 再做身份结合：站在「${name}」（${occupation}，${goal}）的视角，补充可落地的判断、风险、实践步骤或对照思路；若职业是程序员/工程师，优先给可验证的技术解读、实现路径、边界条件与反例，避免空泛鸡汤。`,
    `- 深度按「${depth}」调节：浅则抓主线，适中则概念+用法，深入则机制、取舍与常见坑。`,
    `- 追问时仍以划选与对话上下文为准，先回扣原文再延伸观点。`,
    '',
    '【输出格式】',
    '1. 用中文 Markdown 直接回答（可用加粗、行内代码、列表、表格），不要输出 JSON，不要用大段代码块包住全文。',
    '2. 若使用表格，每一行必须单独换行，且包含表头分隔行（| --- | --- |）。',
    '3. 首轮：先给 1-2 个最值得追问的点（紧扣原文），再给出清晰解答（原文分析 → 身份/职业观点）。',
    '4. 文末单独一节「相关查询：」，每行一条，格式严格为：- 标题 | 搜索词（搜索词应能继续挖原文主题或可验证延伸）。',
    '5. 不要输出 ---、link、空行占位或无效链接。',
    '',
    '【当前文章】',
    `页面标题：${pageTitle || '未知'}`,
    `页面链接：${sourceUrl || '未知'}`,
    `划选内容：\n${text}`,
  ].join('\n');
};

const INITIAL_ASK_USER_PROMPT = [
  '请按系统优先级处理本次划选：',
  '1）先基于当前文章语境，分析这段划选的含义、关键点与可能的疑点；',
  '2）再结合我的身份与职业视角，给出有判断力的观点与可落地建议；',
  '3）提出并回答最值得追问的 1-2 个问题。',
].join('');

const ASK_REVEAL_MIN_CHARS = 72;
const ASK_REVEAL_SOFT_CHARS = 28;

const shouldRevealBufferedAnswer = (buffered: string) => {
  const text = buffered.trim();
  if (!text) {
    return false;
  }
  if (text.length >= ASK_REVEAL_MIN_CHARS) {
    return true;
  }
  // 已到一句完整话，可提前开闸
  return text.length >= ASK_REVEAL_SOFT_CHARS && /[。！？.!?\n]/.test(text);
};

/** 流式输出常把表格挤成一行：把表头/分隔行/数据行拆回多行 */
const normalizeMarkdownTables = (text: string) =>
  text
    .replace(/\|\s+(\|(?:\s*:?-+:?\s*)+\|)/g, '|\n$1')
    .replace(/((?:\|\s*:?-+:?\s*)+\|)\s+\|/g, '$1\n|')
    .replace(/(\|[^\n]+?\|)\s+\|(?=[^|\n]*\|)/g, '$1\n|');

const AskMarkdown = ({ content, streaming }: { content: string; streaming?: boolean }) => {
  const body = normalizeMarkdownTables(displayAnswerBody(content));
  if (!body && streaming) {
    return <span className="selection-ask__caret" aria-hidden="true" />;
  }
  return (
    <div className={cn('selection-ask__md', streaming && 'selection-ask__md--streaming')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="selection-ask__table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}>
        {body}
      </ReactMarkdown>
      {streaming ? <span className="selection-ask__caret" aria-hidden="true" /> : null}
    </div>
  );
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
}: SelectionAskPanelProps) => {
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
  const startedRef = useRef(false);
  const reservoirRef = useRef('');
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

        const items = await listSelectionFavorites();
        if (!cancelled) {
          setFavorites(items);
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
  }, [tab, onFavoritesRefreshReady]);

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
            setFavorites(await listSelectionFavorites());
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
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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
    startedRef.current = false;
    reservoirRef.current = '';
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

    const revealFromReservoir = (extra = '') => {
      const text = `${reservoirRef.current}${extra}`;
      reservoirRef.current = '';
      startedRef.current = true;
      setPendingFirstToken(false);
      setStreamingId(assistantId);
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
          if (!startedRef.current) {
            reservoirRef.current += chunk;
            if (shouldRevealBufferedAnswer(reservoirRef.current)) {
              revealFromReservoir();
            }
            return;
          }
          setMessages(prev =>
            prev.map(item => (item.id === assistantId ? { ...item, content: `${item.content}${chunk}` } : item)),
          );
        },
        controller.signal,
      );

      // 短回答未达阈值：结束时开闸；已开闸则用全文校准
      if (!startedRef.current) {
        reservoirRef.current = reservoirRef.current || full;
        if (reservoirRef.current.trim()) {
          revealFromReservoir();
        }
      }
      const finalText = full.trim() || reservoirRef.current.trim() || '（这次没想好，你可以换个问法再试一次）';
      reservoirRef.current = '';
      setPendingFirstToken(false);
      setMessages(prev => {
        if (prev.some(item => item.id === assistantId)) {
          return prev.map(item => (item.id === assistantId ? { ...item, content: finalText } : item));
        }
        return [...prev, { ...assistantMsg, content: finalText }];
      });
      setLinks(extractLinksFromAnswer(finalText, draft.text, draft.sourceUrl));
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
        setFavorites(await listSelectionFavorites());
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
      setFavorites(await listSelectionFavorites());
    } catch (err) {
      setError(err instanceof Error ? err.message : '收藏失败');
    }
  };

  const openFavoriteSheet = (item: SelectionFavorite) => {
    setSheetFavorite(item);
  };

  const continueFavoriteInAsk = (item: SelectionFavorite) => {
    const hasCurrentAsk =
      Boolean(draft?.text?.trim()) ||
      visibleMessages.length > 0 ||
      loading ||
      pendingFirstToken ||
      Boolean(streamingId);
    const alreadyThisFavorite = favoriteId === item.id && draft?.text === item.text;

    if (hasCurrentAsk && !alreadyThisFavorite) {
      const ok = window.confirm('是否覆盖当前提问内容？继续后，当前对话会被这条收藏替换。');
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
        <>
          <div
            className="selection-ask__scroll"
            ref={listRef}
            onScroll={onScroll}
            onWheel={onWheel}
            onTouchMove={onTouchMove}>
            {draft?.text ? (
              <div className="selection-ask__source-sticky">
                <section
                  className={cn(
                    'selection-ask__card selection-ask__card--source',
                    !sourceExpanded && 'selection-ask__card--source-collapsed',
                  )}>
                  <div className="selection-ask__card-top">
                    <button
                      type="button"
                      className="selection-ask__source-toggle"
                      aria-expanded={sourceExpanded}
                      aria-controls="selection-ask-source-body"
                      onClick={() => setSourceExpanded(prev => !prev)}>
                      <span className="selection-ask__label">提问</span>
                      <ChevronDown
                        className={cn(
                          'selection-ask__source-chevron',
                          sourceExpanded && 'selection-ask__source-chevron--open',
                        )}
                        size={16}
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className={cn('selection-ask__icon-btn', favoriteId && 'selection-ask__icon-btn--active')}
                      aria-label={favoriteId ? '取消收藏关联' : '收藏本次提问（后续回答会同步）'}
                      aria-pressed={Boolean(favoriteId)}
                      onClick={() => void saveCurrent()}>
                      {favoriteId ? (
                        <BookmarkCheck size={16} strokeWidth={2.2} />
                      ) : (
                        <Bookmark size={16} strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                  {sourceExpanded ? (
                    <div id="selection-ask-source-body" className="selection-ask__source-body">
                      <p className="selection-ask__quote">{draft.text}</p>
                      {draft.pageTitle || draft.sourceUrl ? (
                        <div className="selection-ask__meta">
                          {draft.pageTitle ? <p className="selection-ask__meta-title">{draft.pageTitle}</p> : null}
                          {draft.sourceUrl ? (
                            <a
                              className="selection-ask__meta-url"
                              href={draft.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={draft.sourceUrl}>
                              {draft.sourceUrl}
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="selection-ask__quote selection-ask__quote--collapsed" title={draft.text}>
                      {draft.text}
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <section className="selection-ask__empty">
                <p>在网页上划选文字后，右键选择「Study Mind：提问」。</p>
              </section>
            )}

            {visibleMessages.map(msg => (
              <section
                key={msg.id}
                className={cn(
                  'selection-ask__card',
                  msg.role === 'user' ? 'selection-ask__card--user' : 'selection-ask__card--answer',
                  streamingId === msg.id && 'selection-ask__card--streaming',
                )}>
                <p className="selection-ask__label">{msg.role === 'user' ? '追问' : '解答'}</p>
                {msg.role === 'assistant' ? (
                  <AskMarkdown content={msg.content} streaming={streamingId === msg.id} />
                ) : (
                  <p className="selection-ask__quote">{msg.content}</p>
                )}
              </section>
            ))}

            {pendingFirstToken ? (
              <section className="selection-ask__card selection-ask__card--loading" aria-live="polite">
                <p className="selection-ask__label">解答</p>
                <div className="selection-ask__loading-row">
                  <span className="selection-ask__spinner" aria-hidden="true" />
                  <p className="selection-ask__loading-text">正在结合文章与你的视角整理解答…</p>
                </div>
                <div className="selection-ask__loading-skeleton" aria-hidden="true">
                  <span className="selection-ask__loading-line selection-ask__loading-line--lg" />
                  <span className="selection-ask__loading-line selection-ask__loading-line--md" />
                  <span className="selection-ask__loading-line selection-ask__loading-line--sm" />
                </div>
              </section>
            ) : null}

            {links.length > 0 && !pendingFirstToken && !streamingId ? (
              <section className="selection-ask__card">
                <p className="selection-ask__label">相关查询</p>
                <ul className="selection-ask__links">
                  {links.map(link => (
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

          {(error || showComposer) && (
            <footer className="selection-ask__footer">
              {error ? (
                <div className="selection-ask__error">
                  <p>{error}</p>
                  {!isLlmConfigured(llm) ? (
                    <button
                      type="button"
                      className="selection-ask__link-btn"
                      onClick={() => void chrome.runtime.openOptionsPage()}>
                      去设置
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="selection-ask__link-btn"
                      onClick={() =>
                        void sendFollowUp(INITIAL_ASK_USER_PROMPT, {
                          initial: true,
                          hideUser: true,
                        })
                      }>
                      重试
                    </button>
                  )}
                </div>
              ) : null}

              {showComposer ? (
                <form
                  className="selection-ask__composer"
                  onSubmit={event => {
                    event.preventDefault();
                    void sendFollowUp(input);
                  }}>
                  <div className="selection-ask__input-shell">
                    <textarea
                      ref={inputRef}
                      className="selection-ask__input"
                      rows={1}
                      value={input}
                      placeholder="继续追问…"
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
                          void sendFollowUp(input);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className={cn('selection-ask__send', canSend && 'selection-ask__send--active')}
                      disabled={!canSend}
                      aria-label="发送追问">
                      <ArrowUp size={18} strokeWidth={2.4} />
                    </button>
                  </div>
                </form>
              ) : null}
            </footer>
          )}
        </>
      ) : (
        <div className="selection-ask__scroll">
          {favorites.length === 0 ? (
            <section className="selection-ask__empty">
              <p>还没有收藏。点提问页书签后，之后的解答、追问和相关链接都会持续同步到这里。</p>
            </section>
          ) : visibleFavorites.length === 0 ? (
            <section className="selection-ask__empty">
              <p>这一天还没有收藏。换个日期看看，或先去提问页收藏。</p>
            </section>
          ) : (
            <div className="selection-ask__fav-list">
              {visibleFavorites.map(item => (
                <article
                  key={item.id}
                  className="selection-ask__card selection-ask__card--source selection-ask__fav-card">
                  <div className="selection-ask__card-top">
                    <p className="selection-ask__label">
                      提问 · {formatFavoriteTime(item.updatedAt || item.createdAt)}
                    </p>
                    <button
                      type="button"
                      className="selection-ask__icon-btn"
                      aria-label="删除收藏"
                      onClick={() => {
                        void (async () => {
                          await deleteSelectionFavorite(item.id);
                          setFavorites(await listSelectionFavorites());
                          if (favoriteId === item.id) {
                            setFavoriteId(null);
                            favoriteCreatedAtRef.current = null;
                          }
                          if (sheetFavorite?.id === item.id) {
                            setSheetFavorite(null);
                          }
                        })();
                      }}>
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>

                  <button type="button" className="selection-ask__fav-open" onClick={() => openFavoriteSheet(item)}>
                    <p className="selection-ask__quote">{item.text}</p>
                    {item.pageTitle || item.sourceUrl ? (
                      <div className="selection-ask__meta">
                        {item.pageTitle ? <p className="selection-ask__meta-title">{item.pageTitle}</p> : null}
                        {item.sourceUrl ? (
                          <span className="selection-ask__meta-url" title={item.sourceUrl}>
                            {item.sourceUrl}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <SheetFrame
        open={Boolean(sheetFavorite)}
        showHeader={false}
        ariaLabel="收藏内容"
        isLight={isLight}
        className="selection-ask__fav-sheet"
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
        }>
        {sheetFavorite ? (
          <div className="selection-ask__fav-sheet-body">
            <section className="selection-ask__card selection-ask__card--source">
              <p className="selection-ask__label">提问</p>
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
                  {msg.role === 'assistant' ? (
                    <AskMarkdown content={msg.content} />
                  ) : (
                    <p className="selection-ask__quote">{msg.content}</p>
                  )}
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

export default SelectionAskPanel;
