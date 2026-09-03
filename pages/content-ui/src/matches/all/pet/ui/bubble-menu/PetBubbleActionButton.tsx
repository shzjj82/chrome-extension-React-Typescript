import type { PetInteractionAction } from '../../types';

type PetBubbleActionButtonProps = {
  action: PetInteractionAction;
};

const PetBubbleActionButton = ({ action }: PetBubbleActionButtonProps) => {
  if (action.actionText && action.headLine) {
    return (
      <span className="sm-pet__thought-copy">
        {action.headLine}
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
        {action.secondaryActionText && action.onSecondarySelect ? (
          <>
            <span className="sm-pet__thought-or" aria-hidden="true">
              {' '}
              or{' '}
            </span>
            <button
              type="button"
              className="sm-pet__thought-link sm-pet__thought-link--inline"
              title={action.secondaryTitle ?? action.secondaryActionText}
              aria-label={action.secondaryAriaLabel ?? action.secondaryActionText}
              onClick={event => {
                event.stopPropagation();
                action.onSecondarySelect?.();
              }}>
              {action.secondaryActionText}
            </button>
          </>
        ) : null}
        {action.trailingText ? <span className="sm-pet__thought-text">{action.trailingText}</span> : null}
      </span>
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
