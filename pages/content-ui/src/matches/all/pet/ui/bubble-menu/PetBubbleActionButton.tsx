import type { PetInteractionAction } from '../../types';

type PetBubbleActionButtonProps = {
  action: PetInteractionAction;
};

const PetBubbleActionButton = ({ action }: PetBubbleActionButtonProps) => {
  if (action.actionText && action.headLine) {
    return (
      <div className="sm-pet__thought-adopt">
        <span className="sm-pet__thought-line">{action.headLine}</span>
        <span className="sm-pet__thought-line sm-pet__thought-line--action">
          {action.tailPrefix ? <span className="sm-pet__thought-text">{action.tailPrefix}</span> : null}
          <button
            type="button"
            className="sm-pet__thought-link sm-pet__thought-link--inline"
            title={action.title ?? action.label}
            aria-label={action.ariaLabel ?? action.label}
            onClick={event => {
              event.stopPropagation();
              action.onSelect();
            }}>
            {action.actionText}
          </button>
          {action.trailingText ? <span className="sm-pet__thought-text">{action.trailingText}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="sm-pet__thought-link"
      title={action.title ?? action.label}
      aria-label={action.ariaLabel ?? action.label}
      onClick={event => {
        event.stopPropagation();
        action.onSelect();
      }}>
      {action.label}
    </button>
  );
};

export { PetBubbleActionButton };
export type { PetBubbleActionButtonProps };
