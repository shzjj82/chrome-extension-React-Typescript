import BackIconButton from './BackIconButton';
import { callChatCompletion } from './lib/learning';
import { useStorage } from '@extension/shared';
import { isLlmConfigured, llmSettingsStorage, normalizeUserProfile, userProfileStorage } from '@extension/storage';
import { cn } from '@extension/ui';
import { ArrowUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type ChatRole = 'user' | 'assistant';

type ChatBubble = {
  id: string;
  role: ChatRole;
  content: string;
};

type PetChatPanelProps = {
  isLight: boolean;
  onBack?: () => void;
};

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

const PetChatPanel = ({ isLight, onBack }: PetChatPanelProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const welcomeText = profile.nickname
    ? `嗨，${profile.nickname}～我在这儿。想聊什么都可以跟我说。`
    : '嗨～我在这儿。想聊什么都可以跟我说。';

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatBubble[]>(() => [
    { id: 'welcome', role: 'assistant', content: welcomeText },
  ]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, error]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      setError('还没配置模型，请先在设置里填写 API Key');
      return;
    }

    const userMsg: ChatBubble = { id: `u-${Date.now()}`, role: 'user', content: text };
    setInput('');
    setError('');
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => m.id !== 'welcome' || m.role === 'assistant')
        .slice(-12)
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await callChatCompletion(llm, [
        {
          role: 'system',
          content: buildPetSystemPrompt(profile.nickname, profile.occupation, profile.domains, profile.goal),
        },
        ...history,
      ]);

      setMessages(prev => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: reply.trim() || '（我这边没想好，再说一次？）' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setLoading(false);
    }
  };

  const canSend = Boolean(input.trim()) && !loading;

  return (
    <div className={cn('side-panel sm-shell pet-chat', !isLight && 'sm-shell--dark')}>
      <div className="browse-toolbar pet-chat__toolbar">{onBack ? <BackIconButton onClick={onBack} /> : null}</div>

      <div className="pet-chat__list" ref={listRef}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn('pet-chat__row', msg.role === 'user' ? 'pet-chat__row--user' : 'pet-chat__row--pet')}>
            <div
              className={cn(
                'pet-chat__bubble',
                msg.role === 'user' ? 'pet-chat__bubble--user' : 'pet-chat__bubble--pet',
              )}>
              <p className="pet-chat__text">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading ? (
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
