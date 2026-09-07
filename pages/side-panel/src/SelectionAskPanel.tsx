import BackIconButton from './BackIconButton';
import { callChatCompletion } from './lib/learning';
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
import { cn } from '@extension/ui';
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LearningGoal, KnowledgeDepth, UserProfileType } from '@extension/storage';

type SelectionAskPanelProps = {
  isLight: boolean;
  onBack?: () => void;
};

type AskLink = {
  title: string;
  url: string;
};

type AskResult = {
  answer: string;
  links: AskLink[];
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

const stripCodeFence = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return trimmed;
};

const searchUrl = (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

const buildFallbackLinks = (text: string, sourceUrl: string): AskLink[] => {
  const q = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  const links: AskLink[] = [
    { title: `搜索：${q.slice(0, 24)}${q.length > 24 ? '…' : ''}`, url: searchUrl(q) },
    { title: 'Google 搜索', url: `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  ];
  if (sourceUrl) {
    links.unshift({ title: '来源页面', url: sourceUrl });
  }
  return links;
};

const parseAskResult = (raw: string, text: string, sourceUrl: string): AskResult => {
  try {
    const data = JSON.parse(stripCodeFence(raw)) as {
      answer?: string;
      links?: Array<{ title?: string; url?: string; query?: string }>;
    };
    const links: AskLink[] = [];
    for (const item of data.links ?? []) {
      const title = (item.title || item.query || '').trim();
      if (item.url?.startsWith('http')) {
        links.push({ title: title || item.url, url: item.url });
        continue;
      }
      if (item.query?.trim()) {
        links.push({ title: title || item.query.trim(), url: searchUrl(item.query.trim()) });
      }
    }
    return {
      answer: (data.answer || '').trim() || raw.trim(),
      links: links.length > 0 ? links.slice(0, 8) : buildFallbackLinks(text, sourceUrl),
    };
  } catch {
    return {
      answer: raw.trim(),
      links: buildFallbackLinks(text, sourceUrl),
    };
  }
};

const buildAskPrompt = (profile: UserProfileType, text: string, pageTitle: string, sourceUrl: string) => {
  const name = profile.nickname.trim() || '学习者';
  return [
    '你是 Study Mind 的学习提问助手。',
    `请站在用户「${name}」的视角，结合其身份与学习方向，对划选内容提出并回答关键问题。`,
    `职业：${profile.occupation || '未填写'}；领域：${profile.domains || '未填写'}；目标：${goalLabel(profile.goal)}；深度：${depthLabel(profile.depth)}。`,
    '要求：',
    '1. 先用用户口吻整理 1-2 个值得追问的问题，再给出清晰解答。',
    '2. 解释要贴合用户目标与深度，避免空泛。',
    '3. 给出 3-6 条相关查询/资料：可用真实 URL，或只给 query（搜索词）。',
    '4. 严格输出 JSON，不要其它说明：{"answer":"...","links":[{"title":"...","url":"https://..."} ,{"title":"...","query":"..."}]}',
    '',
    `页面标题：${pageTitle || '未知'}`,
    `页面链接：${sourceUrl || '未知'}`,
    `划选内容：\n${text}`,
  ].join('\n');
};

const SelectionAskPanel = ({ isLight, onBack }: SelectionAskPanelProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const draft = useStorage(selectionAskDraftStorage);
  const favoritesState = useStorage(selectionFavoritesStorage);
  const favorites = favoritesState.items;

  const [tab, setTab] = useState<'ask' | 'favorites'>(draft?.text ? 'ask' : 'favorites');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);
  const [askedKey, setAskedKey] = useState('');

  const draftKey = useMemo(() => (draft ? `${draft.createdAt}:${draft.text.slice(0, 40)}` : ''), [draft]);

  useEffect(() => {
    if (!draftKey) {
      return;
    }
    setTab('ask');
    setResult(null);
    setError('');
    setAskedKey('');
  }, [draftKey]);

  const runAsk = async () => {
    if (!draft?.text) {
      setError('没有划选内容');
      return;
    }
    if (!isLlmConfigured(llm)) {
      setError('还没配置模型，请先在设置里填写 API Key');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const raw = await callChatCompletion(llm, [
        {
          role: 'system',
          content: buildAskPrompt(profile, draft.text, draft.pageTitle, draft.sourceUrl),
        },
        {
          role: 'user',
          content: '请按 JSON 格式输出提问与解答，以及相关链接。',
        },
      ]);
      setResult(parseAskResult(raw, draft.text, draft.sourceUrl));
      setAskedKey(draftKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提问失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!draft?.text || loading || askedKey === draftKey) {
      return;
    }
    if (!isLlmConfigured(llm)) {
      return;
    }
    void runAsk();
    // 仅在新草稿进入时自动提问
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

  return (
    <div className={cn('side-panel sm-shell selection-ask', !isLight && 'sm-shell--dark')}>
      <PhoneStatusBar className="selection-ask__status" leading={onBack ? <BackIconButton onClick={onBack} /> : null} />

      <div className="selection-ask__header">
        <h1 className="selection-ask__title">滑词助手</h1>
        <div className="selection-ask__tabs">
          <button
            type="button"
            className={cn('selection-ask__tab', tab === 'ask' && 'selection-ask__tab--active')}
            onClick={() => setTab('ask')}>
            提问
          </button>
          <button
            type="button"
            className={cn('selection-ask__tab', tab === 'favorites' && 'selection-ask__tab--active')}
            onClick={() => setTab('favorites')}>
            收藏
          </button>
        </div>
      </div>

      {tab === 'ask' ? (
        <div className="selection-ask__scroll">
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
                <button type="button" className="selection-ask__link-btn" onClick={() => void runAsk()}>
                  重试
                </button>
              )}
            </div>
          ) : null}

          {loading ? <p className="selection-ask__loading">正在结合你的学习方向提问…</p> : null}

          {result && !loading ? (
            <>
              <section className="selection-ask__card">
                <p className="selection-ask__label">解答</p>
                <div className="selection-ask__answer">{result.answer}</div>
              </section>

              <section className="selection-ask__card">
                <p className="selection-ask__label">相关查询</p>
                <ul className="selection-ask__links">
                  {result.links.map(link => (
                    <li key={`${link.title}-${link.url}`}>
                      <a className="selection-ask__link" href={link.url} target="_blank" rel="noreferrer">
                        <span>{link.title}</span>
                        <ExternalLink size={14} strokeWidth={2} />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {draft?.text && !loading && !result && isLlmConfigured(llm) ? (
            <button type="button" className="selection-ask__primary" onClick={() => void runAsk()}>
              开始提问
            </button>
          ) : null}
        </div>
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
