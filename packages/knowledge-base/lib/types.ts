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
};
