import { Trash2 } from 'lucide-react';
import type { SelectionFavorite } from '@extension/knowledge-base';

type FavoritesTabProps = {
  favoritesTotal: number;
  items: SelectionFavorite[];
  onGoAsk: () => void;
  onOpen: (item: SelectionFavorite) => void;
  onDelete: (item: SelectionFavorite) => void;
  formatTime: (at: number) => string;
};

const FavoritesTab = ({ favoritesTotal, items, onGoAsk, onOpen, onDelete, formatTime }: FavoritesTabProps) => (
  <div className="selection-ask__scroll">
    {favoritesTotal === 0 ? (
      <div className="browse-empty">
        <p className="browse-empty__title">还没有收藏</p>
        <p className="browse-empty__hint">
          去
          <button type="button" className="browse-empty__link" onClick={onGoAsk}>
            提问
          </button>
          页点书签，解答与追问会同步到这里
        </p>
      </div>
    ) : items.length === 0 ? (
      <div className="browse-empty">
        <p className="browse-empty__title">这一天还没有收藏</p>
        <p className="browse-empty__hint">
          换个日期看看，或先去
          <button type="button" className="browse-empty__link" onClick={onGoAsk}>
            提问
          </button>
          页收藏
        </p>
      </div>
    ) : (
      <div className="selection-ask__fav-list">
        {items.map(item => (
          <article key={item.id} className="selection-ask__card selection-ask__card--source selection-ask__fav-card">
            <div className="selection-ask__card-top">
              <p className="selection-ask__label">提问 · {formatTime(item.updatedAt || item.createdAt)}</p>
              <button
                type="button"
                className="selection-ask__icon-btn"
                aria-label="删除收藏"
                onClick={() => onDelete(item)}>
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </div>

            <button type="button" className="selection-ask__fav-open" onClick={() => onOpen(item)}>
              <p className="selection-ask__quote">{item.text}</p>
              {item.pageTitle || item.sourceUrl ? (
                <div className="selection-ask__meta">
                  {item.pageTitle ? <p className="selection-ask__meta-title">{item.pageTitle}</p> : null}
                  {item.sourceUrl ? (
                    <span className="selection-ask__meta-url" title={item.sourceUrl}>
                      {item.sourceUrl}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          </article>
        ))}
      </div>
    )}
  </div>
);

export default FavoritesTab;
export type { FavoritesTabProps };
