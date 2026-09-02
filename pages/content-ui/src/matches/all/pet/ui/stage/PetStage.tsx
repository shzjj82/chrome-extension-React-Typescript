import { PetSpriteHost } from './PetSpriteHost';
import type { RefObject } from 'react';

type PetStageProps = {
  hostRef: RefObject<HTMLDivElement | null>;
};

/** 小狗舞台：拖拽手柄 + 精灵容器 */
const PetStage = ({ hostRef }: PetStageProps) => (
  <div className="sm-pet__stage">
    <PetSpriteHost hostRef={hostRef} />
  </div>
);

export { PetStage };
export type { PetStageProps };
