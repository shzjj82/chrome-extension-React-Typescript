import BackIconButton from './BackIconButton';
import { callChatCompletionStream } from './lib/learning';
import PhoneStatusBar from './PhoneStatusBar';
import { listPetChatMessagesPage, savePetChatMessage } from '@extension/knowledge-base';
import { useStorage } from '@extension/shared';
import { isLlmConfigured, llmSettingsStorage, normalizeUserProfile, userProfileStorage } from '@extension/storage';
import { cn } from '@extension/ui';
import { ArrowUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PetChatMessage } from '@extension/knowledge-base';

type PetChatPanelProps = {
  isLight: boolean;
  onBack?: () => void;
};

const PAGE_SIZE = 20;
const TIME_GAP_MS = 5 * 60_000;

const pad2 = (n: number) => String(n).padStart(2, '0');

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 聊天历史距离文案 */
const formatChatDistance = (at: number, now = Date.now()) => {
  const diff = Math.max(0, now - at);
  const minute = 60_000;
  const hour = 60 * minute;
  const date = new Date(at);
  const current = new Date(now);
  const hm = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (diff < minute) {
    return '刚刚';
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)} 分钟前`;
  }
  if (sameDay(date, current)) {
    return `今天 ${hm}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(current.getDate() - 1);
  if (sameDay(date, yesterday)) {
    return `昨天 ${hm}`;
  }
  if (date.getFullYear() === current.getFullYear()) {
    return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${hm}`;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${hm}`;
};

const shouldShowTimeLabel = (currentAt: number, previousAt?: number) =>
  previousAt == null || currentAt - previousAt >= TIME_GAP_MS;

const buildPetSystemPrompt = (nickname: string, occupation: string, domains: string, goal: string) => {
  const name = nickname.trim() || '你';
  return [
    '你是 Study Mind 里的陪伴宠物，语气温暖、简短、口语化，像贴身小伙伴。',
    `用户称呼：${name}。`,
    occupation ? `职业：${occupation}。` : '',
    domains ? `关注领域：${domains}。` : '',
    goal ? `学习目标：${goal}。` : '',
    '可以陪聊天、鼓励专注、轻量答疑；不要长篇大论，一般控制在 2–5 句。',
    '只用中文回复。不要自称 AI 模型，就用宠物伙伴的口吻。',
  ]
    .filter(Boolean)
    .join('');
};

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const PetChatPanel = ({ isLight, onBack }: PetChatPanelProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const welcomeText = profile.nickname
    ? `嗨，${profile.nickname}～我在这儿。想聊什么都可以跟我说。`
    : '嗨～我在这儿。想聊什么都可以跟我说。';

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<PetChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const page = await listPetChatMessagesPage({ limit: PAGE_SIZE });
        if (cancelled) {
          return;
        }
        setMessages(page.messages);
        setHasMore(page.hasMore);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载聊天记录失败');
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
          stickToBottomRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, streamingId, error, booting]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const loadOlder = async () => {
    if (loadingMore || !hasMore || messages.length === 0) {
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

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceToBottom < 48;
    if (el.scrollTop < 48) {
      void loadOlder();
    }
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      setError('还没配置模型，请先在设置里填写 API Key');
      return;
    }

    const now = Date.now();
    const userMsg: PetChatMessage = {
      id: createLocalId(),
      role: 'user',
      content: text,
      createdAt: now,
    };
    const assistantId = createLocalId();
    const assistantMsg: PetChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now + 1,
    };

    setInput('');
    setError('');
    stickToBottomRef.current = true;
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreamingId(assistantId);
    setLoading(true);

    try {
      await savePetChatMessage(userMsg);

      const history = [...messages, userMsg].slice(-12).map(m => ({ role: m.role, content: m.content }));

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const full = await callChatCompletionStream(
        llm,
        [
          {
            role: 'system',
            content: buildPetSystemPrompt(profile.nickname, profile.occupation, profile.domains, profile.goal),
          },
          ...history,
        ],
        chunk => {
          setMessages(prev =>
            prev.map(item => (item.id === assistantId ? { ...item, content: `${item.content}${chunk}` } : item)),
          );
        },
        controller.signal,
      );

      const finalText = full.trim() || '（我这边没想好，再说一次？）';
      const saved = await savePetChatMessage({
        id: assistantId,
        role: 'assistant',
        content: finalText,
        createdAt: assistantMsg.createdAt,
      });
      setMessages(prev => prev.map(item => (item.id === assistantId ? saved : item)));
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

  const canSend = Boolean(input.trim()) && !loading;
  const showWelcome = !booting && messages.length === 0;

  return (
    <div className={cn('side-panel sm-shell pet-chat', !isLight && 'sm-shell--dark')}>
      <PhoneStatusBar className="pet-chat__status" leading={onBack ? <BackIconButton onClick={onBack} /> : null} />

      <div className="pet-chat__list" ref={listRef} onScroll={onListScroll}>
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
          return (
            <div key={msg.id} className="pet-chat__block">
              {showTime ? (
                <p className="pet-chat__time" title={new Date(msg.createdAt).toLocaleString()}>
                  {formatChatDistance(msg.createdAt, nowTick)}
                </p>
              ) : null}
              <div className={cn('pet-chat__row', msg.role === 'user' ? 'pet-chat__row--user' : 'pet-chat__row--pet')}>
                <div
                  className={cn(
                    'pet-chat__bubble',
                    msg.role === 'user' ? 'pet-chat__bubble--user' : 'pet-chat__bubble--pet',
                    streamingId === msg.id && 'pet-chat__bubble--streaming',
                  )}>
                  <p className="pet-chat__text">
                    {msg.content}
                    {streamingId === msg.id ? <span className="pet-chat__caret" aria-hidden="true" /> : null}
                  </p>
                </div>
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

export default PetChatPanel;
