import { cn } from '@extension/ui';
import { Bookmark } from 'lucide-react';
import type { ReactNode } from 'react';

const MAX_SHEETS = 3;

type FolderCardAccent = 'rose' | 'amber';

type FolderCardCheckbox = {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
};

type FolderCardProps = {
  title: string;
  subtitle: string;
  countLabel: ReactNode;
  sheetCount: number;
  favoriteMark?: boolean;
  accent?: FolderCardAccent;
  selected?: boolean;
  /** 专注页多选；聊天汇总卡不传 */
  checkbox?: FolderCardCheckbox;
  onOpen: () => void;
  openLabel?: string;
  className?: string;
};

const FolderGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
    />
  </svg>
);

const FileGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm1 7V3.5L19.5 9H15z"
    />
  </svg>
);

const FolderSheets = ({ count, favoriteMark = false }: { count: number; favoriteMark?: boolean }) => {
  const sheets = Math.max(1, Math.min(MAX_SHEETS, count));
  return (
    <div className="folder-card__stage">
      {Array.from({ length: sheets }, (_, index) => {
        const fromBack = sheets - 1 - index;
        return (
          <span key={index} className={`folder-card__hit folder-card__hit--${fromBack}`}>
            <span className={`folder-card__sheet folder-card__sheet--${fromBack}`}>
              {favoriteMark && fromBack === 0 ? (
                <span className="folder-card__fav-mark" aria-hidden="true">
                  <Bookmark size={12} strokeWidth={2.6} absoluteStrokeWidth />
                </span>
              ) : null}
              <span className="folder-card__skeleton">
                <span className="folder-card__skeleton-line folder-card__skeleton-line--title" />
                <span className="folder-card__skeleton-line folder-card__skeleton-line--lg" />
                <span className="folder-card__skeleton-line folder-card__skeleton-line--md" />
                <span className="folder-card__skeleton-line folder-card__skeleton-line--sm" />
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
};

const FolderCard = ({
  title,
  subtitle,
  countLabel,
  sheetCount,
  favoriteMark = false,
  accent = 'rose',
  selected = false,
  checkbox,
  onOpen,
  openLabel = '查看',
  className,
}: FolderCardProps) => (
  <article
    className={cn(
      'folder-card',
      `folder-card--${accent}`,
      selected && 'folder-card--selected',
      !checkbox && 'folder-card--plain',
      className,
    )}>
    {checkbox ? (
      <label className="folder-card__check">
        <input
          type="checkbox"
          checked={checkbox.checked}
          onChange={checkbox.onChange}
          aria-label={checkbox.ariaLabel}
        />
      </label>
    ) : null}
    <div className="folder-card__preview" />
    <FolderSheets count={sheetCount} favoriteMark={favoriteMark} />
    <div className="folder-card__body">
      <div className="folder-card__head">
        <span className="folder-card__folder-icon">
          <FolderGlyph />
        </span>
        <div className="folder-card__titles">
          <p className="folder-card__title">{title}</p>
          <p className="folder-card__subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="folder-card__foot">
        <span className="folder-card__count">
          <FileGlyph />
          {countLabel}
        </span>
        <button type="button" className="folder-card__open" onClick={onOpen}>
          {openLabel}
        </button>
      </div>
    </div>
  </article>
);

export default FolderCard;
export { FolderSheets, FolderGlyph, FileGlyph };
export type { FolderCardAccent, FolderCardCheckbox, FolderCardProps };
