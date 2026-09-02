import type { ReactNode, RefObject } from 'react';

type PetRootProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  children: ReactNode;
};

/** 固定定位根节点 */
const PetRoot = ({ rootRef, ariaLabel, children }: PetRootProps) => (
  <div ref={rootRef} className="sm-pet" role="img" aria-label={ariaLabel}>
    {children}
  </div>
);

export { PetRoot };
export type { PetRootProps };
