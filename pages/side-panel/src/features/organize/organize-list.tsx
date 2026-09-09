import { excerpt, formatTime } from './organize-format';
import { pageLabel } from './organize-source';
import type { BrowseItem, FavoriteItem } from './organize-source';
import type { SelectionFavorite } from '@extension/knowledge-base';

type OrganizeListProps = {
  browseItems: BrowseItem[];
  favoriteItems: FavoriteItem[];
  showChecks?: boolean;
  selected?: Set<string>;
  onToggleKey?: (key: string) => void;
  onOpenBrowse: (url: string) => void;
  onOpenFavorite: (favorite: SelectionFavorite) => void;
};

const OrganizeList = ({
  browseItems,
  favoriteItems,
  showChecks = false,
  selected,
  onToggleKey,
  onOpenBrowse,
  onOpenFavorite,
}: OrganizeListProps) => (
  <>
    {browseItems.length > 0 ? (
      <section className="organize-panel__group" aria-label="浏览快照">
        <h2 className="organize-panel__group-title">浏览快照</h2>
        <div className="folder-file-list organize-panel__list">
          {browseItems.map(item => {
            const checked = selected?.has(item.key) ?? false;
            return (
              <article key={item.key} className="folder-file organize-panel__item">
                <div className="organize-panel__item-row">
                  {showChecks ? (
                    <label className="organize-panel__check organize-panel__check--item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleKey?.(item.key)}
                        onClick={event => event.stopPropagation()}
                        aria-label={`选择 ${pageLabel(item.record)}`}
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="folder-file__row organize-panel__item-main"
                    onClick={() => onOpenBrowse(item.record.url)}>
                    <span className="folder-file__body">
                      <span className="folder-file__title">{pageLabel(item.record)}</span>
                      <span className="folder-file__meta">
                        {item.siteLabel} · {formatTime(item.record.recordedAt)}
                        {item.record.material?.trim() ? ` · ${excerpt(item.record.material)}` : ' · （无正文快照）'}
                      </span>
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ) : null}

    {favoriteItems.length > 0 ? (
      <section className="organize-panel__group" aria-label="提问收藏">
        <h2 className="organize-panel__group-title">提问收藏</h2>
        <div className="folder-file-list organize-panel__list">
          {favoriteItems.map(item => {
            const checked = selected?.has(item.key) ?? false;
            return (
              <article key={item.key} className="folder-file organize-panel__item">
                <div className="organize-panel__item-row">
                  {showChecks ? (
                    <label className="organize-panel__check organize-panel__check--item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleKey?.(item.key)}
                        onClick={event => event.stopPropagation()}
                        aria-label={`选择 ${item.favorite.text}`}
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="folder-file__row organize-panel__item-main"
                    onClick={() => onOpenFavorite(item.favorite)}>
                    <span className="folder-file__body">
                      <span className="folder-file__title">{item.favorite.text}</span>
                      <span className="folder-file__meta">
                        {item.siteLabel} · {formatTime(item.favorite.updatedAt || item.favorite.createdAt)}
                      </span>
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ) : null}
  </>
);

export default OrganizeList;
