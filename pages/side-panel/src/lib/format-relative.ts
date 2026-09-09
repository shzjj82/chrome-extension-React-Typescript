/** 相对日期 / 相对时间文案（浏览列表、短信等共用） */

const pad2 = (n: number) => String(n).padStart(2, '0');

const sameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type RelativeDayKind = 'today' | 'yesterday' | 'other';

const getRelativeDayKind = (date: Date, now = new Date()): RelativeDayKind => {
  if (sameCalendarDay(date, now)) {
    return 'today';
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) {
    return 'yesterday';
  }
  return 'other';
};

/** dateKey `YYYY-M-D` / `YYYY-MM-DD` → 「今天 · …」类标签 */
const formatRelativeDateKeyLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) {
    return dateKey;
  }
  const date = new Date(y, m - 1, d);
  const kind = getRelativeDayKind(date);
  if (kind === 'today') {
    return `今天 · ${dateKey}`;
  }
  if (kind === 'yesterday') {
    return `昨天 · ${dateKey}`;
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

type ChatDistanceRule = {
  /** 满足则采用；按数组顺序优先匹配 */
  match: (ctx: { diffMs: number; at: Date; now: Date; hm: string }) => string | null;
};

const CHAT_DISTANCE_RULES: ChatDistanceRule[] = [
  {
    match: ({ diffMs }) => (diffMs < 60_000 ? '刚刚' : null),
  },
  {
    match: ({ diffMs }) => (diffMs < 3_600_000 ? `${Math.floor(diffMs / 60_000)} 分钟前` : null),
  },
  {
    match: ({ at, now, hm }) => (getRelativeDayKind(at, now) === 'today' ? `今天 ${hm}` : null),
  },
  {
    match: ({ at, now, hm }) => (getRelativeDayKind(at, now) === 'yesterday' ? `昨天 ${hm}` : null),
  },
  {
    match: ({ at, now, hm }) =>
      at.getFullYear() === now.getFullYear() ? `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${hm}` : null,
  },
  {
    match: ({ at, hm }) => `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${hm}`,
  },
];

const formatChatDistance = (at: number, now = Date.now()) => {
  const diffMs = Math.max(0, now - at);
  const atDate = new Date(at);
  const nowDate = new Date(now);
  const hm = `${pad2(atDate.getHours())}:${pad2(atDate.getMinutes())}`;
  const ctx = { diffMs, at: atDate, now: nowDate, hm };

  for (const rule of CHAT_DISTANCE_RULES) {
    const label = rule.match(ctx);
    if (label) {
      return label;
    }
  }
  return hm;
};

export type { RelativeDayKind };
export { sameCalendarDay, getRelativeDayKind, formatRelativeDateKeyLabel, formatChatDistance };
