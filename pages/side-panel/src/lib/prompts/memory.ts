/**
 * 上下文记忆归档：跨会话复用的轻量契约。
 * 记忆只注入 system、后台抽取入库；不在用户可见回复中展示。
 */

type MemoryChannel = 'message' | 'organize' | 'ask' | 'exam' | 'review';

type MemoryArchiveEntry = {
  id: string;
  channel: MemoryChannel;
  /** 一句话事实，供后续 system 注入 */
  fact: string;
  /** 可选来源会话 */
  threadId?: string;
  createdAt: number;
  /** 置信：confirmed=用户认可或模型归档区；candidate=对话中的〔记忆候选〕 */
  confidence: 'confirmed' | 'candidate';
};

type ChatTurn = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type PackHistoryOptions = {
  maxTurns?: number;
  /** 将原始 content 映射为发给模型的文本（如展开整理卡） */
  mapContent?: (content: string, role: ChatTurn['role']) => string;
};

const DEFAULT_MAX_TURNS = 12;

/** 模型专用隐藏块：用户界面必须剥离后展示 */
const MEMORY_BLOCK_OPEN = '%%sm-memory%%';
const MEMORY_BLOCK_CLOSE = '%%/sm-memory%%';

const MEMORY_BLOCK_RE = /(?:^|\n)\s*%%sm-memory%%\s*\n[\s\S]*?(?:\n\s*%%\/sm-memory%%\s*|(?=$))/i;
const MEMORY_HEADING_RE = /(?:^|\n)#{1,3}\s*记忆归档\s*\n[\s\S]*?(?=(?:\n#{1,3}\s+\S)|$)/i;
const MEMORY_BOLD_RE = /(?:^|\n)\*\*记忆归档\*\*[：:]?\s*\n[\s\S]*?(?=(?:\n#{1,3}\s+\S)|$)/i;
const CANDIDATE_LINE_RE = /(?:^|\n)\s*〔记忆候选〕\s*.+$/gm;

const pushFact = (facts: string[], raw: string) => {
  const fact = raw.replace(/\s+/g, ' ').trim();
  if (fact.length >= 4 && fact.length <= 120) {
    facts.push(fact);
  }
};

const collectListFacts = (section: string, facts: string[]) => {
  for (const line of section.split('\n')) {
    const m = line.match(/^\s*[-*]\s+(.+)\s*$/);
    if (m?.[1]) {
      pushFact(facts, m[1]);
    }
  }
};

/** 从助手回复中抽取记忆条目（含隐藏块与旧版可见标题，便于兼容） */
const extractMemoryCandidates = (assistantText: string): string[] => {
  const text = assistantText.trim();
  if (!text) {
    return [];
  }

  const facts: string[] = [];
  const candidateLine = text.match(/〔记忆候选〕\s*(.+)$/m);
  if (candidateLine?.[1]) {
    pushFact(facts, candidateLine[1]);
  }

  const hidden = text.match(/%%sm-memory%%\s*\n([\s\S]*?)(?:\n\s*%%\/sm-memory%%|$)/i);
  if (hidden?.[1]) {
    collectListFacts(hidden[1], facts);
  }

  const archiveSection = text.split(/\n##?\s*记忆归档\s*\n/i)[1] ?? text.split(/\n\*\*记忆归档\*\*[：:]?\s*\n/i)[1];
  if (archiveSection) {
    for (const line of archiveSection.split('\n')) {
      if (/^\s*#{1,3}\s+\S/.test(line) && !/记忆归档/.test(line)) {
        break;
      }
      if (/^\s*%%sm-memory%%/i.test(line)) {
        break;
      }
      const m = line.match(/^\s*[-*]\s+(.+)\s*$/);
      if (m?.[1]) {
        pushFact(facts, m[1]);
      }
    }
  }

  return [...new Set(facts)];
};

/** 去掉记忆相关段落，只保留用户该看到的整理/对话正文 */
const stripMemoryForDisplay = (assistantText: string): string =>
  assistantText
    .replace(MEMORY_BLOCK_RE, '\n')
    .replace(MEMORY_HEADING_RE, '\n')
    .replace(MEMORY_BOLD_RE, '\n')
    .replace(CANDIDATE_LINE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const formatMemoryBlock = (entries: MemoryArchiveEntry[]) => {
  if (entries.length === 0) {
    return '';
  }
  return entries
    .slice(-24)
    .map((item, index) => `${index + 1}. (${item.channel}/${item.confidence}) ${item.fact}`)
    .join('\n');
};

/** 打包近期对话供 LLM；默认保留末尾 maxTurns 条 */
const packChatHistoryForLlm = (turns: ChatTurn[], options?: PackHistoryOptions): ChatTurn[] => {
  const maxTurns = Math.max(2, options?.maxTurns ?? DEFAULT_MAX_TURNS);
  const mapContent = options?.mapContent;
  return turns.slice(-maxTurns).map(turn => ({
    role: turn.role,
    content: mapContent ? mapContent(turn.content, turn.role) : turn.content,
  }));
};

const createMemoryId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toMemoryEntries = (
  facts: string[],
  meta: { channel: MemoryChannel; threadId?: string; confidence?: MemoryArchiveEntry['confidence'] },
): MemoryArchiveEntry[] => {
  const now = Date.now();
  return facts.map(fact => ({
    id: createMemoryId(),
    channel: meta.channel,
    fact,
    threadId: meta.threadId,
    createdAt: now,
    confidence: meta.confidence ?? 'candidate',
  }));
};

export type { MemoryChannel, MemoryArchiveEntry, ChatTurn, PackHistoryOptions };
export {
  DEFAULT_MAX_TURNS,
  MEMORY_BLOCK_OPEN,
  MEMORY_BLOCK_CLOSE,
  extractMemoryCandidates,
  stripMemoryForDisplay,
  formatMemoryBlock,
  packChatHistoryForLlm,
  createMemoryId,
  toMemoryEntries,
};
