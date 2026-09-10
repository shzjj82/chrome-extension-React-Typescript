import OrganizeNoteView from '../pet-chat/organize-note-view';
import { useStorage } from '@extension/shared';
import { reviewNotesStorage } from '@extension/storage';
import { cn } from '@extension/ui';
import { useConfirm } from '@src/components/confirm-dialog';
import { parseOrganizeNote } from '@src/lib/prompts/organize-note';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReviewNoteItem } from '@extension/storage';

type ReviewPanelProps = {
  isLight: boolean;
};

const formatAddedAt = (at: number) =>
  new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ReviewCard = ({
  item,
  expanded,
  onToggle,
  onRemove,
}: {
  item: ReviewNoteItem;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) => {
  const note = useMemo(() => {
    const encoded = JSON.stringify(item.note);
    return parseOrganizeNote(encoded);
  }, [item.note]);

  return (
    <article className={cn('review-card', expanded && 'review-card--open')}>
      <button type="button" className="review-card__head" onClick={onToggle} aria-expanded={expanded}>
        <div className="review-card__head-main">
          <p className="review-card__title">{item.title}</p>
          {!expanded && item.preview ? <p className="review-card__preview">{item.preview}</p> : null}
          <p className="review-card__meta">{formatAddedAt(item.createdAt)}</p>
        </div>
        <ChevronDown className={cn('review-card__chevron', expanded && 'review-card__chevron--open')} size={16} />
      </button>

      {expanded ? (
        <div className="review-card__body">
          {note ? <OrganizeNoteView note={note} /> : <p className="review-card__empty">笔记内容无法解析</p>}
          <div className="review-card__footer">
            <button type="button" className="review-card__remove" onClick={onRemove}>
              <Trash2 size={13} strokeWidth={2} />
              移除
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
};

const ReviewPanel = ({ isLight }: ReviewPanelProps) => {
  const confirm = useConfirm();
  const state = useStorage(reviewNotesStorage);
  const items = state.items ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onRemove = async (item: ReviewNoteItem) => {
    const ok = await confirm({
      title: '移除这条复习笔记？',
      message: `「${item.title}」将从复习列表删除，不影响整理会话里的原回复。`,
      confirmLabel: '移除',
      cancelLabel: '取消',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }
    if (expandedId === item.id) {
      setExpandedId(null);
    }
    await reviewNotesStorage.removeNote(item.id);
  };

  return (
    <div className={cn('review-panel', !isLight && 'review-panel--dark')}>
      {items.length === 0 ? (
        <div className="review-panel__empty">
          <p className="review-panel__empty-title">还没有复习笔记</p>
          <p className="review-panel__empty-hint">在「整理」里对结构化回复点「加入笔记」后，会出现在这里。</p>
        </div>
      ) : (
        <div className="review-panel__list">
          {items.map(item => (
            <ReviewCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
              onRemove={() => void onRemove(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;
