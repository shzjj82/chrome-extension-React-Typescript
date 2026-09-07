type LearningMode = 'note' | 'quiz' | 'practice';
type MaterialSource = 'page' | 'caption' | 'visible_caption' | 'paste' | 'subtitle_file';
type QuizKind = 'basic' | 'extend';

type QuizItem = {
  id: string;
  kind: QuizKind;
  question: string;
  answer: string;
  userAnswer: string;
};

type PracticeItem = {
  id: string;
  task: string;
  userResult: string;
};

type StudySession = {
  id: string;
  title: string;
  sourceUrl: string;
  material: string;
  materialSource: MaterialSource;
  mode: LearningMode;
  noteContent: string;
  quizzes: QuizItem[];
  practices: PracticeItem[];
  pomodoroMinutes: number;
  pomodoroCount: number;
  remark: string;
  createdAt: number;
  updatedAt: number;
};

type StudySessionInput = Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

/** 分页/内容变化后的单页浏览记录（IndexedDB）；仅专注会话内写入 */
type BrowsePageTrigger = 'route' | 'pager-click' | 'content-change' | 'manual' | 'focus-enter';

type BrowsePageRecord = {
  id: string;
  /** 本地日期 YYYY-MM-DD */
  dateKey: string;
  /** 记录时间戳 */
  recordedAt: number;
  url: string;
  title: string;
  material: string;
  fingerprint: string;
  trigger: BrowsePageTrigger;
  similarity: number;
};

type BrowsePageInput = Omit<BrowsePageRecord, 'id' | 'dateKey'> & {
  id?: string;
  dateKey?: string;
};

type BrowseDayGroup = {
  dateKey: string;
  records: BrowsePageRecord[];
};

/** 短信 / 宠物聊天 */
type PetChatRole = 'user' | 'assistant';

/** pending：尚未总结标题；ready：已有标题 */
type PetChatTitleStatus = 'pending' | 'ready';

type PetChatThread = {
  id: string;
  title: string;
  titleStatus: PetChatTitleStatus;
  /** 列表预览：最近一条消息摘要 */
  preview: string;
  createdAt: number;
  updatedAt: number;
};

type PetChatThreadInput = {
  id?: string;
  title?: string;
  titleStatus?: PetChatTitleStatus;
  preview?: string;
  createdAt?: number;
  updatedAt?: number;
};

type PetChatMessage = {
  id: string;
  threadId: string;
  role: PetChatRole;
  content: string;
  createdAt: number;
};

type PetChatMessageInput = Omit<PetChatMessage, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

type PetChatPage = {
  messages: PetChatMessage[];
  /** 是否还有更早的消息 */
  hasMore: boolean;
};

/** 滑词提问收藏（IndexedDB） */
type SelectionFavoriteMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
};

type SelectionFavoriteLink = {
  title: string;
  url: string;
};

type SelectionFavorite = {
  id: string;
  text: string;
  sourceUrl: string;
  pageTitle: string;
  createdAt: number;
  /** 收藏时的对话快照（含追问） */
  messages: SelectionFavoriteMessage[];
  /** 相关查询链接 */
  links: SelectionFavoriteLink[];
  updatedAt: number;
};

type SelectionFavoriteInput = Omit<SelectionFavorite, 'id' | 'createdAt' | 'updatedAt' | 'messages' | 'links'> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  messages?: SelectionFavoriteMessage[];
  links?: SelectionFavoriteLink[];
};

export type {
  LearningMode,
  MaterialSource,
  QuizKind,
  QuizItem,
  PracticeItem,
  StudySession,
  StudySessionInput,
  BrowsePageTrigger,
  BrowsePageRecord,
  BrowsePageInput,
  BrowseDayGroup,
  PetChatRole,
  PetChatTitleStatus,
  PetChatThread,
  PetChatThreadInput,
  PetChatMessage,
  PetChatMessageInput,
  PetChatPage,
  SelectionFavorite,
  SelectionFavoriteInput,
  SelectionFavoriteMessage,
  SelectionFavoriteLink,
};
