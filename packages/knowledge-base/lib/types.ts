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

export type { LearningMode, MaterialSource, QuizKind, QuizItem, PracticeItem, StudySession, StudySessionInput };
