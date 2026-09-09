import { displayAnswerBody, normalizeMarkdownTables } from './ask-links';
import { cn } from '@extension/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type AskMarkdownProps = {
  content: string;
  streaming?: boolean;
};

const AskMarkdown = ({ content, streaming }: AskMarkdownProps) => {
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

export default AskMarkdown;
