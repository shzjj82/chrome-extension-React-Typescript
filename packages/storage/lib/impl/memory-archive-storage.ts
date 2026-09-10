import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type MemoryArchiveChannel = 'message' | 'organize' | 'ask' | 'exam' | 'review';

type MemoryArchiveItem = {
  id: string;
  channel: MemoryArchiveChannel;
  fact: string;
  threadId?: string;
  createdAt: number;
  confidence: 'confirmed' | 'candidate';
};

type MemoryArchiveState = {
  items: MemoryArchiveItem[];
};

type MemoryArchiveStorageType = BaseStorageType<MemoryArchiveState> & {
  appendFacts: (
    facts: string[],
    meta: {
      channel: MemoryArchiveChannel;
      threadId?: string;
      confidence?: MemoryArchiveItem['confidence'];
    },
  ) => Promise<MemoryArchiveItem[]>;
  listForPrompt: (options?: { channel?: MemoryArchiveChannel; limit?: number }) => Promise<MemoryArchiveItem[]>;
};

const MAX_ITEMS = 80;

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const storage = createStorage<MemoryArchiveState>(
  'memory-archive',
  { items: [] },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

const appendFacts: MemoryArchiveStorageType['appendFacts'] = async (facts, meta) => {
  const cleaned = [...new Set(facts.map(item => item.replace(/\s+/g, ' ').trim()).filter(item => item.length >= 4))];
  if (cleaned.length === 0) {
    return [];
  }
  const now = Date.now();
  const created: MemoryArchiveItem[] = cleaned.map(fact => ({
    id: createId(),
    channel: meta.channel,
    fact: fact.slice(0, 160),
    threadId: meta.threadId,
    createdAt: now,
    confidence: meta.confidence ?? 'candidate',
  }));

  await storage.set(prev => {
    const merged = [...(prev.items ?? []), ...created];
    // 同文案去重，保留最新
    const seen = new Set<string>();
    const deduped: MemoryArchiveItem[] = [];
    for (let i = merged.length - 1; i >= 0; i -= 1) {
      const item = merged[i]!;
      const key = `${item.channel}::${item.fact}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(item);
    }
    return { items: deduped.reverse().slice(-MAX_ITEMS) };
  });

  return created;
};

const listForPrompt: MemoryArchiveStorageType['listForPrompt'] = async (options = {}) => {
  const state = await storage.get();
  const limit = Math.max(1, options.limit ?? 24);
  let items = state.items ?? [];
  if (options.channel) {
    // 同通道优先，再补其它通道
    const primary = items.filter(item => item.channel === options.channel);
    const others = items.filter(item => item.channel !== options.channel);
    items = [...primary.slice(-limit), ...others].slice(-limit);
  } else {
    items = items.slice(-limit);
  }
  return items;
};

const memoryArchiveStorage: MemoryArchiveStorageType = {
  ...storage,
  appendFacts,
  listForPrompt,
};

export type { MemoryArchiveChannel, MemoryArchiveItem, MemoryArchiveState, MemoryArchiveStorageType };
export { memoryArchiveStorage };
