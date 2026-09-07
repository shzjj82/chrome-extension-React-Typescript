import BackIconButton from './BackIconButton';
import { callChatCompletionStream } from './lib/learning';
import PhoneStatusBar from './PhoneStatusBar';
import { useStorage } from '@extension/shared';
import {
  isLlmConfigured,
  llmSettingsStorage,
  normalizeUserProfile,
  selectionAskDraftStorage,
  selectionFavoritesStorage,
  userProfileStorage,
} from '@extension/storage';
import { SegmentedSwitch, cn } from '@extension/ui';
import { ArrowUp, Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { LearningGoal, KnowledgeDepth, UserProfileType } from '@extension/storage';

type SelectionAskPanelProps = {
  isLight: boolean;
  onBack?: () => void;
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
  return [
    '你是 Study Mind 的学习提问助手。',
    `请站在用户「${name}」的视角，结合其身份与学习方向，围绕划选内容讲解并回答追问。`,
    `职业：${profile.occupation || '未填写'}；领域：${profile.domains || '未填写'}；目标：${goalLabel(profile.goal)}；深度：${depthLabel(profile.depth)}。`,
    '要求：',
    '1. 用中文 Markdown 直接回答（可用加粗、行内代码、列表），不要输出 JSON，不要用大段代码块包住全文。',
    '2. 首轮可先点出 1-2 个值得追问的点，再给出清晰解答。',
    '3. 解释贴合用户目标与深度；后续追问请结合对话上下文，紧扣划选内容。',
    '4. 文末单独一节「相关查询：」，每行一条，格式严格为：- 标题 | 搜索词',
    '5. 不要输出 ---、link、空行占位或无效链接。',
    '',
    `页面标题：${pageTitle || '未知'}`,
    `页面链接：${sourceUrl || '未知'}`,
    `划选内容：\n${text}`,
  ].join('\n');
};

const AskMarkdown = ({ content, streaming }: { content: string; streaming?: boolean }) => {
  const body = displayAnswerBody(content);
  if (!body && streaming) {
    return <span className="selection-ask__caret" aria-hidden="true" />;
  }
  return (
    <div className={cn('selection-ask__md', streaming && 'selection-ask__md--streaming')}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}>
        {body}
      </ReactMarkdown>
      {streaming ? <span className="selection-ask__caret" aria-hidden="true" /> : null}
    </div>
  );
};

const SelectionAskPanel = ({ isLight, onBack }: SelectionAskPanelProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const draft = useStorage(selectionAskDraftStorage);
  const favoritesState = useStorage(selectionFavoritesStorage);
  const favorites = favoritesState.items;

  const [tab, setTab] = useState<'ask' | 'favorites'>(draft?.text ? 'ask' : 'favorites');
  const [loading, setLoading] = useState(false);
  /** 等待首字吐出前为 true：只展示 loading，不展示空回复/输入框 */
  const [pendingFirstToken, setPendingFirstToken] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [links, setLinks] = useState<AskLink[]>([]);
  const [input, setInput] = useState('');
  const [askedKey, setAskedKey] = useState('');

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);
  const startedRef = useRef(false);

  const draftKey = useMemo(() => (draft ? `${draft.createdAt}:${draft.text.slice(0, 40)}` : ''), [draft]);
  const visibleMessages = useMemo(
    () => messages.filter(msg => !msg.hidden && msg.content.trim().length > 0),
    [messages],
  );
  const showComposer =
    Boolean(draft?.text) && !pendingFirstToken && !error && (visibleMessages.length > 0 || askedKey === draftKey);

  useEffect(() => {
    if (!draftKey) {
      return;
    }
    abortRef.current?.abort();
    setTab('ask');
    setMessages([]);
    setLinks([]);
    setError('');
    setInput('');
    setAskedKey('');
    setStreamingId(null);
    setLoading(false);
    setPendingFirstToken(false);
    stickToBottomRef.current = true;
  }, [draftKey]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, pendingFirstToken, streamingId, error, links]);

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

    const history = [...messages, userMsg];
    startedRef.current = false;
    setInput('');
    setError('');
    setLinks([]);
    stickToBottomRef.current = true;
    setMessages(history);
    setStreamingId(null);
    setPendingFirstToken(true);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
            startedRef.current = true;
            setPendingFirstToken(false);
            setStreamingId(assistantId);
            setMessages(prev => [...prev, { ...assistantMsg, content: chunk }]);
            return;
          }
          setMessages(prev =>
            prev.map(item => (item.id === assistantId ? { ...item, content: `${item.content}${chunk}` } : item)),
          );
        },
        controller.signal,
      );

      const finalText = full.trim() || '（这次没想好，你可以换个问法再试一次）';
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

  useEffect(() => {
    if (!draft?.text || loading || askedKey === draftKey) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      return;
    }
    void sendFollowUp('请基于划选内容，提出并回答最值得追问的问题。', { initial: true, hideUser: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const saveCurrent = async () => {
    if (!draft?.text) {
      return;
    }
    try {
      await selectionFavoritesStorage.addFavorite({
        text: draft.text,
        sourceUrl: draft.sourceUrl,
        pageTitle: draft.pageTitle,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '收藏失败');
    }
  };

  const canSend = Boolean(input.trim()) && !loading && Boolean(draft?.text) && isLlmConfigured(llm);

  return (
    <div className={cn('side-panel sm-shell selection-ask', !isLight && 'sm-shell--dark')}>
      <PhoneStatusBar className="selection-ask__status" leading={onBack ? <BackIconButton onClick={onBack} /> : null} />

      <div className="selection-ask__header">
        <h1 className="selection-ask__title">滑词助手</h1>
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

      {tab === 'ask' ? (
        <>
          <div
            className="selection-ask__scroll"
            ref={listRef}
            onScroll={event => {
              const el = event.currentTarget;
              stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            }}>
            {draft?.text ? (
              <section className="selection-ask__card">
                <div className="selection-ask__card-top">
                  <p className="selection-ask__label">划选内容</p>
                  <button
                    type="button"
                    className="selection-ask__icon-btn"
                    aria-label="收藏这段内容"
                    onClick={() => void saveCurrent()}>
                    <Bookmark size={16} strokeWidth={2.2} />
                  </button>
                </div>
                <p className="selection-ask__quote">{draft.text}</p>
                {draft.pageTitle || draft.sourceUrl ? (
                  <p className="selection-ask__meta">
                    {draft.pageTitle || '未命名页面'}
                    {draft.sourceUrl ? ` · ${draft.sourceUrl}` : ''}
                  </p>
                ) : null}
                <p className="selection-ask__profile">
                  以 {profile.nickname || '你'}（{profile.occupation || '学习者'}
                  {profile.domains ? ` · ${profile.domains}` : ''} · {goalLabel(profile.goal)}）视角提问
                </p>
              </section>
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
                  <p className="selection-ask__loading-text">正在整理学习资料，稍等一下…</p>
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
                        void sendFollowUp('请基于划选内容，提出并回答最值得追问的问题。', {
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
              <p>还没有收藏。划选文字后右键「Study Mind：收藏」即可保存。</p>
            </section>
          ) : (
            <ul className="selection-ask__fav-list">
              {favorites.map(item => (
                <li key={item.id} className="selection-ask__fav-item">
                  <button
                    type="button"
                    className="selection-ask__fav-main"
                    onClick={() => {
                      void selectionAskDraftStorage.set({
                        text: item.text,
                        sourceUrl: item.sourceUrl,
                        pageTitle: item.pageTitle,
                        createdAt: Date.now(),
                      });
                      setTab('ask');
                    }}>
                    <p className="selection-ask__fav-text">{item.text}</p>
                    <p className="selection-ask__meta">
                      {item.pageTitle || '未命名页面'}
                      {item.sourceUrl ? ` · ${item.sourceUrl}` : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="selection-ask__icon-btn"
                    aria-label="删除收藏"
                    onClick={() => void selectionFavoritesStorage.removeFavorite(item.id)}>
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectionAskPanel;
