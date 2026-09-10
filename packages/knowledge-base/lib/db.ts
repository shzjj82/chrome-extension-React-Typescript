import { PetChatChannel } from './types.js';
import type {
  BrowseDayGroup,
  BrowsePageInput,
  BrowsePageRecord,
  PetChatMessage,
  PetChatMessageInput,
  PetChatPage,
  PetChatThread,
  PetChatThreadInput,
  SelectionFavorite,
  SelectionFavoriteInput,
  StudySession,
  StudySessionInput,
} from './types.js';

const DB_NAME = 'study-mind';
const DB_VERSION = 6;
const SESSION_STORE = 'sessions';
const BROWSE_STORE = 'browse-pages';
const PET_CHAT_STORE = 'pet-chat-messages';
const PET_CHAT_THREAD_STORE = 'pet-chat-threads';
const SELECTION_FAVORITE_STORE = 'selection-favorites';

const clipText = (text: string, max: number) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) {
    return '';
  }
  return t.length <= max ? t : `${t.slice(0, max)}…`;
};

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const applySchemaUpgrade = (db: IDBDatabase, tx: IDBTransaction | null, oldVersion: number) => {
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

  if (oldVersion < 4 && tx) {
    if (!db.objectStoreNames.contains(PET_CHAT_THREAD_STORE)) {
      const store = db.createObjectStore(PET_CHAT_THREAD_STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt', { unique: false });
      store.createIndex('channel', 'channel', { unique: false });
    }

    const msgStore = tx.objectStore(PET_CHAT_STORE);
    if (!msgStore.indexNames.contains('threadId')) {
      msgStore.createIndex('threadId', 'threadId', { unique: false });
    }
    if (!msgStore.indexNames.contains('byThreadCreatedAt')) {
      msgStore.createIndex('byThreadCreatedAt', ['threadId', 'createdAt'], { unique: false });
    }

    const getAllReq = msgStore.getAll();
    getAllReq.onsuccess = () => {
      const all = getAllReq.result as Array<PetChatMessage & { threadId?: string }>;
      const orphans = all.filter(item => !item.threadId);
      if (orphans.length === 0) {
        return;
      }

      const threadId = createId();
      const createdAt = Math.min(...orphans.map(item => item.createdAt));
      const updatedAt = Math.max(...orphans.map(item => item.createdAt));
      const firstUser = orphans.find(item => item.role === 'user');
      const last = orphans.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
      const title = clipText(firstUser?.content ?? '以前的对话', 12) || '以前的对话';

      tx.objectStore(PET_CHAT_THREAD_STORE).put({
        id: threadId,
        title,
        titleStatus: 'ready',
        channel: PetChatChannel.Message,
        preview: clipText(last.content, 40),
        createdAt,
        updatedAt,
      } satisfies PetChatThread);

      for (const msg of orphans) {
        msgStore.put({ ...msg, threadId });
      }
    };
  }

  if (oldVersion < 5) {
    if (!db.objectStoreNames.contains(SELECTION_FAVORITE_STORE)) {
      const store = db.createObjectStore(SELECTION_FAVORITE_STORE, { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    }
  }

  if (oldVersion < 6 && tx) {
    const store = tx.objectStore(PET_CHAT_THREAD_STORE);
    if (!store.indexNames.contains('channel')) {
      store.createIndex('channel', 'channel', { unique: false });
    }
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const all = getAllReq.result as Array<PetChatThread & { channel?: PetChatChannel }>;
      for (const thread of all) {
        if (!thread.channel) {
          store.put({ ...thread, channel: PetChatChannel.Message });
        }
      }
    };
  }
};

/**
 * 先探测现有版本：若库已更新到更高版本，禁止再用低版本 open（会触发 VersionError）。
 * 仅当现有版本 < DB_VERSION 时才请求升级。
 */
const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const attachUpgrade = (request: IDBOpenDBRequest) => {
      request.onupgradeneeded = event => {
        applySchemaUpgrade(request.result, request.transaction, event.oldVersion);
      };
    };

    const probe = indexedDB.open(DB_NAME);
    probe.onerror = () => reject(probe.error ?? new Error('Failed to open IndexedDB'));
    probe.onsuccess = () => {
      const existing = probe.result;
      if (existing.version >= DB_VERSION) {
        resolve(existing);
        return;
      }

      existing.close();
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      attachUpgrade(request);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });

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

const normalizePetChatThread = (thread: PetChatThread & { channel?: PetChatChannel }): PetChatThread => ({
  ...thread,
  channel: thread.channel ?? PetChatChannel.Message,
});

const savePetChatThread = async (input: PetChatThreadInput): Promise<PetChatThread> => {
  const db = await openDb();
  const existing = input.id ? await getPetChatThread(input.id) : null;
  const now = Date.now();
  const thread: PetChatThread = {
    id: input.id ?? createId(),
    title: (input.title ?? existing?.title ?? '新对话').trim() || '新对话',
    titleStatus: input.titleStatus ?? existing?.titleStatus ?? 'pending',
    channel: input.channel ?? existing?.channel ?? PetChatChannel.Message,
    preview: input.preview ?? existing?.preview ?? '',
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PET_CHAT_THREAD_STORE, 'readwrite');
    const request = tx.objectStore(PET_CHAT_THREAD_STORE).put(thread);
    request.onsuccess = () => resolve(thread);
    request.onerror = () => reject(request.error ?? new Error('Failed to save pet chat thread'));
  });
};

const createPetChatThread = async (title = '新对话', options?: { channel?: PetChatChannel }): Promise<PetChatThread> =>
  savePetChatThread({
    title,
    titleStatus: 'pending',
    preview: '',
    channel: options?.channel ?? PetChatChannel.Message,
  });

/** 按通道取最新会话；没有则新建。整理通道会合并到单一会话（删掉多余旧线程）。 */
const ensurePetChatThread = async (options: { channel: PetChatChannel; title?: string }): Promise<PetChatThread> => {
  const existing = await listPetChatThreads({ channel: options.channel });
  if (existing.length === 0) {
    return createPetChatThread(options.title ?? '新对话', { channel: options.channel });
  }

  const [primary, ...rest] = existing;
  if (options.channel === PetChatChannel.Organize && rest.length > 0) {
    await Promise.all(rest.map(item => deletePetChatThread(item.id).catch(() => undefined)));
  }

  if (options.title && primary.title !== options.title) {
    return savePetChatThread({
      id: primary.id,
      title: options.title,
      titleStatus: 'ready',
      channel: options.channel,
      preview: primary.preview,
      createdAt: primary.createdAt,
    });
  }

  return primary;
};

const getPetChatThread = async (id: string): Promise<PetChatThread | null> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PET_CHAT_THREAD_STORE, 'readonly');
    const request = tx.objectStore(PET_CHAT_THREAD_STORE).get(id);
    request.onsuccess = () => {
      const row = request.result as (PetChatThread & { channel?: PetChatChannel }) | undefined;
      resolve(row ? normalizePetChatThread(row) : null);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to get pet chat thread'));
  });
};

type ListPetChatThreadsFilter = {
  channel?: PetChatChannel;
};

const listPetChatThreads = async (filter?: ListPetChatThreadsFilter): Promise<PetChatThread[]> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PET_CHAT_THREAD_STORE, 'readonly');
    const store = tx.objectStore(PET_CHAT_THREAD_STORE);
    const request =
      filter?.channel != null && store.indexNames.contains('channel')
        ? store.index('channel').getAll(filter.channel)
        : store.getAll();
    request.onsuccess = () => {
      let threads = (request.result as Array<PetChatThread & { channel?: PetChatChannel }>).map(normalizePetChatThread);
      if (filter?.channel != null && !store.indexNames.contains('channel')) {
        threads = threads.filter(item => item.channel === filter.channel);
      }
      threads.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(threads);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list pet chat threads'));
  });
};

const deletePetChatThread = async (id: string): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([PET_CHAT_THREAD_STORE, PET_CHAT_STORE], 'readwrite');
    const msgStore = tx.objectStore(PET_CHAT_STORE);
    const index = msgStore.index('threadId');
    const range = IDBKeyRange.only(id);
    const cursorReq = index.openCursor(range);

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    tx.objectStore(PET_CHAT_THREAD_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete pet chat thread'));
  });
};

const savePetChatMessage = async (input: PetChatMessageInput): Promise<PetChatMessage> => {
  if (!input.threadId) {
    throw new Error('threadId is required');
  }

  const db = await openDb();
  const message: PetChatMessage = {
    id: input.id ?? createId(),
    threadId: input.threadId,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt ?? Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([PET_CHAT_STORE, PET_CHAT_THREAD_STORE], 'readwrite');
    tx.objectStore(PET_CHAT_STORE).put(message);

    const threadStore = tx.objectStore(PET_CHAT_THREAD_STORE);
    const getReq = threadStore.get(input.threadId);
    getReq.onsuccess = () => {
      const thread = getReq.result as (PetChatThread & { channel?: PetChatChannel }) | undefined;
      if (!thread) {
        return;
      }
      threadStore.put({
        ...normalizePetChatThread(thread),
        preview: clipText(message.content, 40),
        updatedAt: Math.max(thread.updatedAt, message.createdAt),
      } satisfies PetChatThread);
    };

    tx.oncomplete = () => resolve(message);
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save pet chat message'));
  });
};

/**
 * 分页拉取某话题聊天记录（时间正序返回，便于直接渲染）。
 * - 首次：取最新 limit 条
 * - 向上翻页：传 beforeCreatedAt，取更早的 limit 条
 */
const listPetChatMessagesPage = async (options: {
  threadId: string;
  beforeCreatedAt?: number;
  limit?: number;
}): Promise<PetChatPage> => {
  const threadId = options.threadId?.trim();
  if (!threadId) {
    return { messages: [], hasMore: false };
  }

  const limit = Math.max(1, options.limit ?? 20);
  const beforeCreatedAt =
    typeof options.beforeCreatedAt === 'number' && Number.isFinite(options.beforeCreatedAt)
      ? options.beforeCreatedAt
      : undefined;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PET_CHAT_STORE, 'readonly');
    const store = tx.objectStore(PET_CHAT_STORE);

    // 用单字段 threadId 索引，避免复合 key 的 IDBKeyRange.bound 在部分环境下报 invalid key
    const readAllForThread = () => {
      if (store.indexNames.contains('threadId')) {
        return store.index('threadId').getAll(IDBKeyRange.only(threadId));
      }
      return store.getAll();
    };

    const request = readAllForThread();

    request.onsuccess = () => {
      let all = (request.result as PetChatMessage[]).filter(item => item.threadId === threadId);
      all.sort((a, b) => a.createdAt - b.createdAt);

      if (typeof beforeCreatedAt === 'number') {
        all = all.filter(item => item.createdAt < beforeCreatedAt);
      }

      const hasMore = all.length > limit;
      const page = hasMore ? all.slice(all.length - limit) : all;
      resolve({ messages: page, hasMore });
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list pet chat messages'));
  });
};

const saveSelectionFavorite = async (input: SelectionFavoriteInput): Promise<SelectionFavorite> => {
  const text = input.text.trim();
  if (!text) {
    throw new Error('没有可收藏的内容');
  }

  const db = await openDb();
  const now = Date.now();
  const favorite: SelectionFavorite = {
    id: input.id ?? createId(),
    text,
    sourceUrl: input.sourceUrl || '',
    pageTitle: input.pageTitle || '',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    messages: Array.isArray(input.messages) ? input.messages : [],
    links: Array.isArray(input.links) ? input.links : [],
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SELECTION_FAVORITE_STORE, 'readwrite');
    const store = tx.objectStore(SELECTION_FAVORITE_STORE);
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const existing = (getAllReq.result as SelectionFavorite[]).filter(
        item => item.id !== favorite.id && item.text === favorite.text && item.sourceUrl === favorite.sourceUrl,
      );
      for (const item of existing) {
        store.delete(item.id);
      }
      store.put(favorite);
    };

    tx.oncomplete = () => resolve(favorite);
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save selection favorite'));
  });
};

const listSelectionFavorites = async (): Promise<SelectionFavorite[]> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SELECTION_FAVORITE_STORE, 'readonly');
    const store = tx.objectStore(SELECTION_FAVORITE_STORE);
    const request = store.indexNames.contains('createdAt') ? store.index('createdAt').getAll() : store.getAll();

    request.onsuccess = () => {
      const items = (request.result as SelectionFavorite[]).map(item => ({
        ...item,
        messages: Array.isArray(item.messages) ? item.messages : [],
        links: Array.isArray(item.links) ? item.links : [],
        updatedAt: item.updatedAt ?? item.createdAt,
      }));
      items.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      resolve(items.slice(0, 200));
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to list selection favorites'));
  });
};

const deleteSelectionFavorite = async (id: string): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SELECTION_FAVORITE_STORE, 'readwrite');
    tx.objectStore(SELECTION_FAVORITE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete selection favorite'));
  });
};

const findSelectionFavorite = async (text: string, sourceUrl = ''): Promise<SelectionFavorite | null> => {
  const needle = text.trim();
  if (!needle) {
    return null;
  }
  const items = await listSelectionFavorites();
  return items.find(item => item.text === needle && item.sourceUrl === (sourceUrl || '')) ?? null;
};

const getSelectionFavorite = async (id: string): Promise<SelectionFavorite | null> => {
  if (!id) {
    return null;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SELECTION_FAVORITE_STORE, 'readonly');
    const request = tx.objectStore(SELECTION_FAVORITE_STORE).get(id);
    request.onsuccess = () => {
      const item = request.result as SelectionFavorite | undefined;
      if (!item) {
        resolve(null);
        return;
      }
      resolve({
        ...item,
        messages: Array.isArray(item.messages) ? item.messages : [],
        links: Array.isArray(item.links) ? item.links : [],
        updatedAt: item.updatedAt ?? item.createdAt,
      });
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to get selection favorite'));
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
  createPetChatThread,
  ensurePetChatThread,
  getPetChatThread,
  listPetChatThreads,
  savePetChatThread,
  deletePetChatThread,
  savePetChatMessage,
  listPetChatMessagesPage,
  clipText,
  saveSelectionFavorite,
  listSelectionFavorites,
  deleteSelectionFavorite,
  findSelectionFavorite,
  getSelectionFavorite,
};
