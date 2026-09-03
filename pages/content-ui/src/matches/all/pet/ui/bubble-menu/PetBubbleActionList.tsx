import { PetBubbleActionButton } from './PetBubbleActionButton';
import { PetBubbleOrSeparator } from './PetBubbleOrSeparator';
import { Fragment } from 'react';
import type { PetInteractionAction } from '../../types';

type PetBubbleActionListProps = {
  actions: PetInteractionAction[];
};

/** 气泡操作列表：换行由内容与容器宽度决定，不做布局启发式拆行 */
const PetBubbleActionList = ({ actions }: PetBubbleActionListProps) => {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="sm-pet__thought-actions">
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
