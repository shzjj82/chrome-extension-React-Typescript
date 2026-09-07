import type {
  BrowseDayGroup,
  BrowsePageInput,
  BrowsePageRecord,
  PetChatMessage,
  PetChatMessageInput,
  PetChatPage,
  StudySession,
  StudySessionInput,
} from './types.js';

const DB_NAME = 'study-mind';
const DB_VERSION = 3;
const SESSION_STORE = 'sessions';
const BROWSE_STORE = 'browse-pages';
const PET_CHAT_STORE = 'pet-chat-messages';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(BROWSE_STORE)) {
        const store = db.createObjectStore(BROWSE_STORE, { keyPath: 'id' });
        store.createIndex('dateKey', 'dateKey', { unique: false });
        store.createIndex('recordedAt', 'recordedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(PET_CHAT_STORE)) {
        const store = db.createObjectStore(PET_CHAT_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');

const getLocalDateKey = (at = Date.now()) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

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
    const tx = db.transaction(SESSION_STORE, 'readonly');
    const store = tx.objectStore(SESSION_STORE);
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
    const tx = db.transaction(SESSION_STORE, 'readonly');
    const request = tx.objectStore(SESSION_STORE).get(id);

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
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    const request = tx.objectStore(SESSION_STORE).put(session);

    request.onsuccess = () => resolve(session);
    request.onerror = () => reject(request.error ?? new Error('Failed to save session'));
  });
};

const deleteSession = async (id: string): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    const request = tx.objectStore(SESSION_STORE).delete(id);

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

const saveBrowsePage = async (input: BrowsePageInput): Promise<BrowsePageRecord> => {
  const db = await openDb();
  const recordedAt = input.recordedAt || Date.now();
  const record: BrowsePageRecord = {
    id: input.id ?? createId(),
    dateKey: input.dateKey ?? getLocalDateKey(recordedAt),
    recordedAt,
    url: input.url,
    title: input.title,
    material: input.material,
    fingerprint: input.fingerprint,
    trigger: input.trigger,
    similarity: input.similarity,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROWSE_STORE, 'readwrite');
    const request = tx.objectStore(BROWSE_STORE).put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error ?? new Error('Failed to save browse page'));
  });
};

const listBrowsePages = async (): Promise<BrowsePageRecord[]> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROWSE_STORE, 'readonly');
    const request = tx.objectStore(BROWSE_STORE).getAll();

    request.onsuccess = () => {
      const records = (request.result as BrowsePageRecord[]).sort((a, b) => b.recordedAt - a.recordedAt);
      resolve(records);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list browse pages'));
  });
};

const listBrowsePagesByDate = async (dateKey: string): Promise<BrowsePageRecord[]> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROWSE_STORE, 'readonly');
    const index = tx.objectStore(BROWSE_STORE).index('dateKey');
    const request = index.getAll(dateKey);

    request.onsuccess = () => {
      const records = (request.result as BrowsePageRecord[]).sort((a, b) => b.recordedAt - a.recordedAt);
      resolve(records);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list browse pages by date'));
  });
};

const listBrowsePagesGroupedByDay = async (): Promise<BrowseDayGroup[]> => {
  const records = await listBrowsePages();
  const map = new Map<string, BrowsePageRecord[]>();

  for (const record of records) {
    const bucket = map.get(record.dateKey) ?? [];
    bucket.push(record);
    map.set(record.dateKey, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dateKey, dayRecords]) => ({
      dateKey,
      records: dayRecords.sort((a, b) => b.recordedAt - a.recordedAt),
    }));
};

const deleteBrowsePage = async (id: string): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROWSE_STORE, 'readwrite');
    const request = tx.objectStore(BROWSE_STORE).delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete browse page'));
  });
};

const clearBrowsePages = async (): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROWSE_STORE, 'readwrite');
    const request = tx.objectStore(BROWSE_STORE).clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear browse pages'));
  });
};

const getBrowsePage = async (id: string): Promise<BrowsePageRecord | null> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROWSE_STORE, 'readonly');
    const request = tx.objectStore(BROWSE_STORE).get(id);

    request.onsuccess = () => resolve((request.result as BrowsePageRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Failed to get browse page'));
  });
};

const savePetChatMessage = async (input: PetChatMessageInput): Promise<PetChatMessage> => {
  const db = await openDb();
  const message: PetChatMessage = {
    id: input.id ?? createId(),
    role: input.role,
    content: input.content,
    createdAt: input.createdAt ?? Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PET_CHAT_STORE, 'readwrite');
    const request = tx.objectStore(PET_CHAT_STORE).put(message);

    request.onsuccess = () => resolve(message);
    request.onerror = () => reject(request.error ?? new Error('Failed to save pet chat message'));
  });
};

/**
 * 分页拉取聊天记录（时间正序返回，便于直接渲染）。
 * - 首次：取最新 limit 条
 * - 向上翻页：传 beforeCreatedAt，取更早的 limit 条
 */
const listPetChatMessagesPage = async (options?: {
  beforeCreatedAt?: number;
  limit?: number;
}): Promise<PetChatPage> => {
  const limit = Math.max(1, options?.limit ?? 20);
  const beforeCreatedAt = options?.beforeCreatedAt;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PET_CHAT_STORE, 'readonly');
    const index = tx.objectStore(PET_CHAT_STORE).index('createdAt');
    const range = typeof beforeCreatedAt === 'number' ? IDBKeyRange.upperBound(beforeCreatedAt, true) : undefined;
    const request = index.openCursor(range, 'prev');
    const collected: PetChatMessage[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || collected.length >= limit + 1) {
        const hasMore = collected.length > limit;
        const page = hasMore ? collected.slice(0, limit) : collected;
        resolve({
          messages: page.reverse(),
          hasMore,
        });
        return;
      }
      collected.push(cursor.value as PetChatMessage);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list pet chat messages'));
  });
};

export {
  createEmptySession,
  listSessions,
  getSession,
  saveSession,
  deleteSession,
  updateSessionPomodoro,
  getLocalDateKey,
  saveBrowsePage,
  listBrowsePages,
  listBrowsePagesByDate,
  listBrowsePagesGroupedByDay,
  deleteBrowsePage,
  clearBrowsePages,
  getBrowsePage,
  savePetChatMessage,
  listPetChatMessagesPage,
};
