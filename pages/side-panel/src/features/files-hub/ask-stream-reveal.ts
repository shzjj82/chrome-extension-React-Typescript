/** 提问流式「蓄水池」：先缓冲再开闸，避免空泡/半句闪烁 */

const ASK_REVEAL_MIN_CHARS = 72;
const ASK_REVEAL_SOFT_CHARS = 28;

type RevealReservoir = {
  buffer: string;
  started: boolean;
};

type ReservoirChunkResult =
  | { type: 'buffer'; state: RevealReservoir }
  | { type: 'reveal'; text: string; state: RevealReservoir }
  | { type: 'append'; chunk: string; state: RevealReservoir };

const createRevealReservoir = (): RevealReservoir => ({ buffer: '', started: false });

const shouldRevealBufferedAnswer = (buffered: string) => {
  const text = buffered.trim();
  if (!text) {
    return false;
  }
  if (text.length >= ASK_REVEAL_MIN_CHARS) {
    return true;
  }
  return text.length >= ASK_REVEAL_SOFT_CHARS && /[。！？.!?\n]/.test(text);
};

const applyStreamChunk = (state: RevealReservoir, chunk: string): ReservoirChunkResult => {
  if (state.started) {
    return { type: 'append', chunk, state };
  }
  const buffer = `${state.buffer}${chunk}`;
  if (shouldRevealBufferedAnswer(buffer)) {
    return { type: 'reveal', text: buffer, state: { buffer: '', started: true } };
  }
  return { type: 'buffer', state: { buffer, started: false } };
};

const finalizeStreamReveal = (
  state: RevealReservoir,
  full: string,
  emptyFallback = '（这次没想好，你可以换个问法再试一次）',
) => {
  const fromReservoir = state.buffer.trim();
  const fromFull = full.trim();
  const needReveal = !state.started && Boolean(fromReservoir || fromFull);
  const finalText = fromFull || fromReservoir || emptyFallback;
  return {
    needReveal,
    revealText: needReveal ? fromReservoir || fromFull : '',
    finalText,
    state: { buffer: '', started: true } satisfies RevealReservoir,
  };
};

export type { RevealReservoir, ReservoirChunkResult };
export {
  ASK_REVEAL_MIN_CHARS,
  ASK_REVEAL_SOFT_CHARS,
  createRevealReservoir,
  shouldRevealBufferedAnswer,
  applyStreamChunk,
  finalizeStreamReveal,
};
