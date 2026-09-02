import { PetBubbleActionList } from './PetBubbleActionList';
import { PetThoughtBubble } from '../thought-bubble/PetThoughtBubble';
import type { PetInteractionAction } from '../../types';

type PetBubbleMenuProps = {
  visible: boolean;
  facingLeft: boolean;
  actions: PetInteractionAction[];
};

/** 悬停时出现的气泡菜单：聊天气泡 + 可点击操作项 */
const PetBubbleMenu = ({ visible, facingLeft, actions }: PetBubbleMenuProps) => {
  if (!visible || actions.length === 0) {
    return null;
  }

  return (
    <PetThoughtBubble visible={visible} facingLeft={facingLeft}>
      <div className="sm-pet__thought-body">
        <PetBubbleActionList actions={actions} />
      </div>
    </PetThoughtBubble>
  );
};

export { PetBubbleMenu };
export type { PetBubbleMenuProps };
