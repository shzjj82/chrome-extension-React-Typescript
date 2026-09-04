import { callChatCompletion } from './lib/learning';
import { useStorage } from '@extension/shared';
import { isLlmConfigured, llmSettingsStorage, normalizeUserProfile, userProfileStorage } from '@extension/storage';
import { Button, cn } from '@extension/ui';
import { useEffect, useRef, useState } from 'react';

type ChatRole = 'user' | 'assistant';

type ChatBubble = {
  id: string;
  role: ChatRole;
  content: string;
};

type PetChatPanelProps = {
  isLight: boolean;
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

const PetChatPanel = ({ isLight }: PetChatPanelProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const ready = isLlmConfigured(llm);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatBubble[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: profile.nickname
        ? `嗨，${profile.nickname}～我在这儿。想聊什么都可以跟我说。`
        : '嗨～我在这儿。想聊什么都可以跟我说。',
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }
    if (!ready) {
      setError('请先在设置里配置 LLM（填写 API Key）');
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

  return (
    <div className={cn('side-panel sm-shell pet-chat', !isLight && 'sm-shell--dark')}>
      <header className="sm-shell__header">
        <div className="flex items-center justify-between gap-2">
          <h1 className="sm-shell__brand">陪伴 · 聊天</h1>
          <Button size="sm" variant="outline" onClick={() => chrome.runtime.openOptionsPage()}>
            LLM 设置
          </Button>
        </div>
        <p className="sm-shell__muted" style={{ margin: 0 }}>
          {ready ? `模型：${llm.model}` : '尚未配置 LLM，配置后即可与宠物聊天'}
        </p>
      </header>

      <main className="sm-shell__main pet-chat__main">
        {!ready ? (
          <section className="sm-shell__card pet-chat__gate">
            <h2 className="sm-shell__card-title">先连接模型</h2>
            <p className="sm-shell__muted">在选项页填写 API Key（DeepSeek / 通义 / OpenAI 兼容均可），回来就能聊。</p>
            <Button
              className="sm-shell__cta"
              onClick={() => {
                void chrome.runtime.openOptionsPage();
              }}>
              去配置 LLM
            </Button>
          </section>
        ) : (
          <>
            <div className="pet-chat__list" ref={listRef}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    'pet-chat__bubble',
                    msg.role === 'user' ? 'pet-chat__bubble--user' : 'pet-chat__bubble--pet',
                  )}>
                  <span className="pet-chat__who">{msg.role === 'user' ? '你' : '宠物'}</span>
                  <p className="pet-chat__text">{msg.content}</p>
                </div>
              ))}
              {loading ? (
                <div className="pet-chat__bubble pet-chat__bubble--pet pet-chat__bubble--pending">
                  <span className="pet-chat__who">宠物</span>
                  <p className="pet-chat__text">思考中…</p>
                </div>
              ) : null}
            </div>

            {error ? <p className="text-xs text-red-700">{error}</p> : null}

            <form
              className="pet-chat__composer"
              onSubmit={event => {
                event.preventDefault();
                void send();
              }}>
              <textarea
                className="pet-chat__input"
                rows={2}
                value={input}
                placeholder="跟宠物说点什么…"
                disabled={loading}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <Button type="submit" className="sm-shell__cta pet-chat__send" disabled={loading || !input.trim()}>
                发送
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default PetChatPanel;
