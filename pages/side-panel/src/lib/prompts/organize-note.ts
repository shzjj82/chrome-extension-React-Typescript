/**
 * 整理笔记结构化契约（v1）：模型输出 JSON，前端按字段渲染。
 */

const ORGANIZE_NOTE_KIND = 'organize-note' as const;

type OrganizeExtensionKind = 'contrast' | 'pitfall' | 'variant' | 'choose' | 'adjacent';

const ORGANIZE_EXTENSION_KINDS: OrganizeExtensionKind[] = ['contrast', 'pitfall', 'variant', 'choose', 'adjacent'];

const ORGANIZE_EXTENSION_LABEL: Record<OrganizeExtensionKind, string> = {
  contrast: '对照',
  pitfall: '易错',
  variant: '用法变体',
  choose: '选型',
  adjacent: '相邻概念',
};

type OrganizeNoteExtension = {
  kind: OrganizeExtensionKind;
  title?: string;
  body: string;
  code?: string;
};

type OrganizeNoteSection = {
  title: string;
  points: string[];
  usage?: string;
  code?: string;
  extensions: OrganizeNoteExtension[];
};

type OrganizeNoteConcept = {
  term: string;
  summary: string;
};

type OrganizeNote = {
  v: 1;
  kind: typeof ORGANIZE_NOTE_KIND;
  title?: string;
  lead?: string;
  sections: OrganizeNoteSection[];
  concepts?: OrganizeNoteConcept[];
  crossExtensions?: OrganizeNoteExtension[];
  memoryFacts?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(asString).filter(Boolean);
};

const resolveCode = (value: Record<string, unknown>) => {
  const lines = asStringList(value.codeLines);
  if (lines.length > 0) {
    return lines.join('\n');
  }
  return asString(value.code) || undefined;
};

const parseExtension = (value: unknown): OrganizeNoteExtension | null => {
  if (!isRecord(value)) {
    return null;
  }
  const kind = value.kind;
  if (typeof kind !== 'string' || !ORGANIZE_EXTENSION_KINDS.includes(kind as OrganizeExtensionKind)) {
    return null;
  }
  const body = asString(value.body);
  if (!body) {
    return null;
  }
  return {
    kind: kind as OrganizeExtensionKind,
    title: asString(value.title) || undefined,
    body,
    code: resolveCode(value),
  };
};

const parseSection = (value: unknown): OrganizeNoteSection | null => {
  if (!isRecord(value)) {
    return null;
  }
  const title = asString(value.title);
  if (!title) {
    return null;
  }
  const extensions = Array.isArray(value.extensions)
    ? value.extensions.map(parseExtension).filter((item): item is OrganizeNoteExtension => Boolean(item))
    : [];
  return {
    title,
    points: asStringList(value.points),
    usage: asString(value.usage) || undefined,
    code: resolveCode(value),
    extensions,
  };
};

const extractJsonObject = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim().startsWith('{')) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
};

/**
 * 修复模型常见的非法 JSON：字符串值内部未转义的 "，以及裸换行。
 * 用「对象键 / 数组值」状态机，避免把 `"static" :class` 误判为字符串结束。
 */
const repairOrganizeNoteJson = (input: string): string => {
  let out = '';
  let inString = false;
  let escaped = false;
  /** 栈：true=object（下一个字符串是 key），false=array */
  const stack: boolean[] = [];
  let expectKey = false;

  const peekNonWs = (from: number) => {
    let j = from;
    while (j < input.length && /\s/.test(input[j] ?? '')) {
      j += 1;
    }
    return { ch: input[j], index: j };
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] ?? '';

    if (!inString) {
      if (ch === '{') {
        stack.push(true);
        expectKey = true;
        out += ch;
        continue;
      }
      if (ch === '[') {
        stack.push(false);
        expectKey = false;
        out += ch;
        continue;
      }
      if (ch === '}' || ch === ']') {
        stack.pop();
        expectKey = false;
        out += ch;
        continue;
      }
      if (ch === ':') {
        expectKey = false;
        out += ch;
        continue;
      }
      if (ch === ',') {
        const parentIsObject = stack[stack.length - 1] === true;
        expectKey = parentIsObject;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inString = true;
        escaped = false;
        out += ch;
        continue;
      }
      out += ch;
      continue;
    }

    // in string
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '\n') {
      out += '\\n';
      continue;
    }
    if (ch === '\r') {
      out += '\\r';
      continue;
    }
    if (ch === '\t') {
      out += '\\t';
      continue;
    }
    if (ch === '"') {
      if (expectKey) {
        // 对象 key 结束
        inString = false;
        out += ch;
        continue;
      }
      const { ch: next } = peekNonWs(i + 1);
      if (next === ',' || next === '}' || next === ']' || next === undefined) {
        inString = false;
        out += ch;
        continue;
      }
      // 值内部的裸引号（如 class="static"）
      out += '\\"';
      continue;
    }
    out += ch;
  }

  return out;
};

const parseJsonObject = (jsonText: string): unknown => {
  try {
    return JSON.parse(jsonText);
  } catch {
    return JSON.parse(repairOrganizeNoteJson(jsonText));
  }
};

const looksLikeOrganizeNoteJson = (content: string) => {
  const text = content.trim();
  return (
    text.includes(`"kind":"${ORGANIZE_NOTE_KIND}"`) ||
    text.includes(`"kind": "${ORGANIZE_NOTE_KIND}"`) ||
    text.includes(`'kind':'${ORGANIZE_NOTE_KIND}'`)
  );
};

const buildNoteFromData = (data: unknown): OrganizeNote | null => {
  if (!isRecord(data) || data.v !== 1 || data.kind !== ORGANIZE_NOTE_KIND) {
    return null;
  }
  const sections = Array.isArray(data.sections)
    ? data.sections.map(parseSection).filter((item): item is OrganizeNoteSection => Boolean(item))
    : [];
  if (sections.length === 0) {
    return null;
  }
  const concepts = Array.isArray(data.concepts)
    ? data.concepts
        .map(item => {
          if (!isRecord(item)) {
            return null;
          }
          const term = asString(item.term);
          const summary = asString(item.summary);
          if (!term || !summary) {
            return null;
          }
          return { term, summary };
        })
        .filter((item): item is OrganizeNoteConcept => Boolean(item))
    : undefined;
  const crossExtensions = Array.isArray(data.crossExtensions)
    ? data.crossExtensions.map(parseExtension).filter((item): item is OrganizeNoteExtension => Boolean(item))
    : undefined;

  return {
    v: 1,
    kind: ORGANIZE_NOTE_KIND,
    title: asString(data.title) || undefined,
    lead: asString(data.lead) || undefined,
    sections,
    concepts: concepts?.length ? concepts : undefined,
    crossExtensions: crossExtensions?.length ? crossExtensions : undefined,
    memoryFacts: asStringList(data.memoryFacts).length ? asStringList(data.memoryFacts) : undefined,
  };
};

const parseOrganizeNote = (content: string): OrganizeNote | null => {
  const jsonText = extractJsonObject(content);
  if (!jsonText) {
    return null;
  }
  try {
    return buildNoteFromData(parseJsonObject(jsonText));
  } catch {
    return null;
  }
};

/** 落库前去掉 memoryFacts，避免进气泡 */
const stripOrganizeNoteMemory = (note: OrganizeNote): OrganizeNote => {
  const next: OrganizeNote = { ...note };
  delete next.memoryFacts;
  return next;
};

const encodeOrganizeNote = (note: OrganizeNote) => JSON.stringify(stripOrganizeNoteMemory(note));

const isOrganizeNoteContent = (content: string) => Boolean(parseOrganizeNote(content));

const buildOrganizeNotePreview = (note: OrganizeNote) => {
  if (note.lead?.trim()) {
    return note.lead.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  const first = note.sections[0];
  if (first?.points[0]) {
    return first.points[0].replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  if (first?.title) {
    return first.title;
  }
  return '结构化整理笔记';
};

const buildOrganizeNoteTitle = (note: OrganizeNote) =>
  note.title?.trim() || note.sections[0]?.title?.trim() || '整理笔记';

export type { OrganizeExtensionKind, OrganizeNoteExtension, OrganizeNoteSection, OrganizeNoteConcept, OrganizeNote };
export {
  ORGANIZE_NOTE_KIND,
  ORGANIZE_EXTENSION_KINDS,
  ORGANIZE_EXTENSION_LABEL,
  parseOrganizeNote,
  looksLikeOrganizeNoteJson,
  stripOrganizeNoteMemory,
  encodeOrganizeNote,
  isOrganizeNoteContent,
  buildOrganizeNotePreview,
  buildOrganizeNoteTitle,
};
