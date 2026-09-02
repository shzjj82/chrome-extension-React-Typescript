import type { RefObject } from 'react';

type PetSpriteHostProps = {
  hostRef: RefObject<HTMLDivElement | null>;
};

/** 雪碧图挂载点（由 PetSpriteRenderer 写入 DOM） */
const PetSpriteHost = ({ hostRef }: PetSpriteHostProps) => <div ref={hostRef} className="sm-pet__canvas-host" />;

export { PetSpriteHost };
export type { PetSpriteHostProps };
