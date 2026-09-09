import AskMarkdown from './ask-markdown';
import { cn } from '@extension/ui';
import { ArrowUp, Bookmark, BookmarkCheck, ChevronDown, ExternalLink } from 'lucide-react';
import type { AskLink } from './ask-links';
import type { RefObject, WheelEvent } from 'react';

type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
};

type AskDraft = {
  text: string;
  pageTitle?: string;
  sourceUrl?: string;
} | null;

type AskTabProps = {
  draft: AskDraft;
  sourceExpanded: boolean;
  onToggleSource: () => void;
  favoriteId: string | null;
  onSaveFavorite: () => void;
  messages: AskMessage[];
  links: AskLink[];
  pendingFirstToken: boolean;
  streamingId: string | null;
  error: string;
  llmConfigured: boolean;
  showComposer: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onClearError: () => void;
  onSend: (text: string) => void;
  onRetryInitial: () => void;
  onOpenOptions: () => void;
  canSend: boolean;
  loading: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onTouchMove: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

const AskTab = ({
  draft,
  sourceExpanded,
  onToggleSource,
  favoriteId,
  onSaveFavorite,
  messages,
  links,
  pendingFirstToken,
  streamingId,
  error,
  llmConfigured,
  showComposer,
  input,
  onInputChange,
  onClearError,
  onSend,
  onRetryInitial,
  onOpenOptions,
  canSend,
  loading,
  listRef,
  onScroll,
  onWheel,
  onTouchMove,
  inputRef,
}: AskTabProps) => (
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
                onClick={onToggleSource}>
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
                onClick={onSaveFavorite}>
                {favoriteId ? <BookmarkCheck size={16} strokeWidth={2.2} /> : <Bookmark size={16} strokeWidth={2.2} />}
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

      {messages.map(msg => (
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
            {!llmConfigured ? (
              <button type="button" className="selection-ask__link-btn" onClick={onOpenOptions}>
                去设置
              </button>
            ) : (
              <button type="button" className="selection-ask__link-btn" onClick={onRetryInitial}>
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
              onSend(input);
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
                  onInputChange(event.target.value);
                  if (error) {
                    onClearError();
                  }
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSend(input);
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
);

export default AskTab;
export type { AskMessage };
