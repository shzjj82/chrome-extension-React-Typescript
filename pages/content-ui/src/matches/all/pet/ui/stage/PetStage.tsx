import { PetSpriteHost } from './PetSpriteHost';
import type { ReactNode, RefObject } from 'react';

type PetStageProps = {
  hostRef: RefObject<HTMLDivElement | null>;
  /** 舞台附件（如专注闹钟），由外部传入，类似气泡 */
  accessory?: ReactNode;
};

/** 宠物舞台：拖拽手柄 + 精灵容器；附件由外部注入 */
const PetStage = ({ hostRef, accessory }: PetStageProps) => (
  <div className="sm-pet__stage">
    {accessory}
    <PetSpriteHost hostRef={hostRef} />
  </div>
);

export { PetStage };
export type { PetStageProps };
