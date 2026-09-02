type ThoughtBubbleLayout = {
  offsetX: string;
  tailNearDog: 'left' | 'right';
};

const getThoughtBubbleLayout = (facingLeft: boolean): ThoughtBubbleLayout => ({
  offsetX: facingLeft ? 'calc(-50% - 18px)' : 'calc(-50% + 18px)',
  tailNearDog: facingLeft ? 'right' : 'left',
});

export type { ThoughtBubbleLayout };
export { getThoughtBubbleLayout };
