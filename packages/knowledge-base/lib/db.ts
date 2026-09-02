import type { StudySession, StudySessionInput } from './types.js';

const DB_NAME = 'study-mind';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createEmptySession = (
  partial: Partial<StudySessionInput> & Pick<StudySessionInput, 'title' | 'material' | 'mode'>,
): StudySession => {
  const now = Date.now();

  return {
    id: partial.id ?? createId(),
    title: partial.title,
    sourceUrl: partial.sourceUrl ?? '',
    material: partial.material,
    materialSource: partial.materialSource ?? 'page',
    mode: partial.mode,
    noteContent: partial.noteContent ?? '',
    quizzes: partial.quizzes ?? [],
    practices: partial.practices ?? [],
    pomodoroMinutes: partial.pomodoroMinutes ?? 0,
    pomodoroCount: partial.pomodoroCount ?? 0,
    remark: partial.remark ?? '',
    createdAt: now,
    updatedAt: now,
  };
};

const listSessions = async (): Promise<StudySession[]> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const sessions = (request.result as StudySession[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(sessions);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list sessions'));
  });
};

const getSession = async (id: string): Promise<StudySession | null> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);

    request.onsuccess = () => resolve((request.result as StudySession | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Failed to get session'));
  });
};

const saveSession = async (input: StudySessionInput): Promise<StudySession> => {
  const db = await openDb();
  const existing = input.id ? await getSession(input.id) : null;
  const now = Date.now();

  const session: StudySession = {
    id: input.id ?? createId(),
    title: input.title,
    sourceUrl: input.sourceUrl,
    material: input.material,
    materialSource: input.materialSource,
    mode: input.mode,
    noteContent: input.noteContent,
    quizzes: input.quizzes,
    practices: input.practices,
    pomodoroMinutes: input.pomodoroMinutes,
    pomodoroCount: input.pomodoroCount,
    remark: input.remark,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(session);

    request.onsuccess = () => resolve(session);
    request.onerror = () => reject(request.error ?? new Error('Failed to save session'));
  });
};

const deleteSession = async (id: string): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete session'));
  });
};

const updateSessionPomodoro = async (
  id: string,
  pomodoroMinutes: number,
  pomodoroCount: number,
): Promise<StudySession | null> => {
  const existing = await getSession(id);
  if (!existing) {
    return null;
  }

  return saveSession({
    ...existing,
    pomodoroMinutes,
    pomodoroCount,
  });
};

export { createEmptySession, listSessions, getSession, saveSession, deleteSession, updateSessionPomodoro };
