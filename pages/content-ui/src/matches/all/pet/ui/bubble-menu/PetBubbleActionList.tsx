import { PetBubbleActionButton } from './PetBubbleActionButton';
import { PetBubbleOrSeparator } from './PetBubbleOrSeparator';
import { Fragment } from 'react';
import type { PetInteractionAction } from '../../types';

type PetBubbleActionListProps = {
  actions: PetInteractionAction[];
};

const needsBubbleWrap = (actions: PetInteractionAction[]) =>
  actions.some(action => action.headLine && action.actionText) ||
  actions.length === 1 ||
  actions.some(action => action.label.length > 5);

const PetBubbleActionList = ({ actions }: PetBubbleActionListProps) => {
  if (actions.length === 0) {
    return null;
  }

  const className = needsBubbleWrap(actions)
    ? 'sm-pet__thought-actions sm-pet__thought-actions--wrap'
    : 'sm-pet__thought-actions';

  return (
    <div className={className}>
      {actions.map((action, index) => (
        <Fragment key={action.id}>
          {index > 0 ? <PetBubbleOrSeparator /> : null}
          <PetBubbleActionButton action={action} />
        </Fragment>
      ))}
    </div>
  );
};

export { PetBubbleActionList };
export type { PetBubbleActionListProps };
