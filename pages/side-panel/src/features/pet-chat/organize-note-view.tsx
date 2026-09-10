import AskMarkdown from '../files-hub/ask-markdown';
import { cn } from '@extension/ui';
import { ORGANIZE_EXTENSION_LABEL } from '@src/lib/prompts/organize-note';
import { BookmarkPlus, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { OrganizeNote, OrganizeNoteExtension } from '@src/lib/prompts/organize-note';

type OrganizeNoteViewProps = {
  note: OrganizeNote;
  streaming?: boolean;
  className?: string;
  onAddToReview?: () => void;
  addToReviewState?: 'idle' | 'adding' | 'added';
};

/** 列表内轻量 Markdown，避免 <p> 塞进 <li> 造成版式错乱 */
const InlineMd = ({ content }: { content: string }) => (
  <ReactMarkdown
    components={{
      p: ({ children }) => <span className="organize-note__inline">{children}</span>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
    }}>
    {content}
  </ReactMarkdown>
);

const ExtensionBlock = ({ item }: { item: OrganizeNoteExtension }) => (
  <div className="organize-note__ext">
    <p className="organize-note__ext-label">
      延展 · {ORGANIZE_EXTENSION_LABEL[item.kind]}
      {item.title ? ` · ${item.title}` : ''}
    </p>
    <AskMarkdown content={item.body} />
    {item.code ? (
      <pre className="organize-note__code">
        <code>{item.code}</code>
      </pre>
    ) : null}
  </div>
);

const OrganizeNoteView = ({
  note,
  streaming,
  className,
  onAddToReview,
  addToReviewState = 'idle',
}: OrganizeNoteViewProps) => (
  <article className={cn('organize-note', streaming && 'organize-note--streaming', className)}>
    {note.title ? <h2 className="organize-note__title">{note.title}</h2> : null}
    {note.lead ? (
      <div className="organize-note__lead">
        <AskMarkdown content={note.lead} />
      </div>
    ) : null}

    {note.sections.map((section, index) => (
      <section key={`${section.title}-${index}`} className="organize-note__section">
        <h3 className="organize-note__section-title">{section.title}</h3>
        {section.points.length > 0 ? (
          <ul className="organize-note__points">
            {section.points.map((point, pointIndex) => (
              <li key={`${pointIndex}-${point.slice(0, 12)}`}>
                <InlineMd content={point} />
              </li>
            ))}
          </ul>
        ) : null}
        {section.usage ? (
          <div className="organize-note__usage">
            <p className="organize-note__sublabel">用法</p>
            <AskMarkdown content={section.usage} />
          </div>
        ) : null}
        {section.code ? (
          <pre className="organize-note__code">
            <code>{section.code}</code>
          </pre>
        ) : null}
        {section.extensions.map((ext, extIndex) => (
          <ExtensionBlock key={`${ext.kind}-${extIndex}`} item={ext} />
        ))}
      </section>
    ))}

    {note.concepts && note.concepts.length > 0 ? (
      <section className="organize-note__concepts">
        <h3 className="organize-note__section-title">概念速查</h3>
        <div className="organize-note__table-wrap">
          <table>
            <thead>
              <tr>
                <th>概念</th>
                <th>一句话</th>
              </tr>
            </thead>
            <tbody>
              {note.concepts.map(item => (
                <tr key={item.term}>
                  <td>{item.term}</td>
                  <td>{item.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : null}

    {note.crossExtensions && note.crossExtensions.length > 0 ? (
      <section className="organize-note__cross">
        <h3 className="organize-note__section-title">综合延展</h3>
        {note.crossExtensions.map((ext, index) => (
          <ExtensionBlock key={`cross-${ext.kind}-${index}`} item={ext} />
        ))}
      </section>
    ) : null}

    {streaming ? <span className="selection-ask__caret" aria-hidden="true" /> : null}

    {!streaming && onAddToReview ? (
      <div className="organize-note__actions">
        <button
          type="button"
          className={cn('organize-note__add-btn', addToReviewState === 'added' && 'organize-note__add-btn--done')}
          disabled={addToReviewState !== 'idle'}
          onClick={onAddToReview}>
          {addToReviewState === 'added' ? (
            <>
              <Check size={14} strokeWidth={2.4} />
              已加入复习
            </>
          ) : addToReviewState === 'adding' ? (
            '加入中…'
          ) : (
            <>
              <BookmarkPlus size={14} strokeWidth={2.2} />
              加入笔记
            </>
          )}
        </button>
      </div>
    ) : null}
  </article>
);

export default OrganizeNoteView;
