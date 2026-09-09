import AskMarkdown from './ask-markdown';
import { cn } from '@extension/ui';
import SheetFrame from '@src/components/sheet-frame';
import { ExternalLink } from 'lucide-react';
import type { SelectionFavorite } from '@extension/knowledge-base';
import type { ReactNode } from 'react';

type FavoriteSheetProps = {
  favorite: SelectionFavorite | null;
  isLight: boolean;
  onClose: () => void;
  sourceLabel?: string;
  /** assistant 消息是否用 Markdown（提问页用，整理页用纯文本） */
  markdownAnswers?: boolean;
  footer?: ReactNode;
};

const FavoriteSheet = ({
  favorite,
  isLight,
  onClose,
  sourceLabel = '提问',
  markdownAnswers = true,
  footer,
}: FavoriteSheetProps) => (
  <SheetFrame
    open={Boolean(favorite)}
    showHeader={false}
    ariaLabel="收藏内容"
    isLight={isLight}
    className="selection-ask__fav-sheet"
    onClose={onClose}
    footer={footer}>
    {favorite ? (
      <div className="selection-ask__fav-sheet-body">
        <section className="selection-ask__card selection-ask__card--source">
          <p className="selection-ask__label">{sourceLabel}</p>
          <p className="selection-ask__quote">{favorite.text}</p>
          {favorite.pageTitle || favorite.sourceUrl ? (
            <div className="selection-ask__meta">
              {favorite.pageTitle ? <p className="selection-ask__meta-title">{favorite.pageTitle}</p> : null}
              {favorite.sourceUrl ? (
                <a
                  className="selection-ask__meta-url"
                  href={favorite.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={favorite.sourceUrl}>
                  {favorite.sourceUrl}
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        {(favorite.messages ?? [])
          .filter(msg => !msg.hidden && msg.content.trim())
          .map(msg => (
            <section
              key={msg.id}
              className={cn(
                'selection-ask__card',
                msg.role === 'user' ? 'selection-ask__card--user' : 'selection-ask__card--answer',
              )}>
              <p className="selection-ask__label">{msg.role === 'user' ? '追问' : '解答'}</p>
              {msg.role === 'assistant' && markdownAnswers ? (
                <AskMarkdown content={msg.content} />
              ) : (
                <p className="selection-ask__quote">{msg.content}</p>
              )}
            </section>
          ))}

        {(favorite.links?.length ?? 0) > 0 ? (
          <section className="selection-ask__card">
            <p className="selection-ask__label">相关查询</p>
            <ul className="selection-ask__links">
              {favorite.links.map(link => (
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
);

export default FavoriteSheet;
