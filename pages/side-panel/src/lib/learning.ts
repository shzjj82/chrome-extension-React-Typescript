import type { LearningMode, PracticeItem, QuizItem } from '@extension/knowledge-base';
import type { LlmSettingsType, UserProfileType } from '@extension/storage';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type GeneratedContent = {
  noteContent: string;
  quizzes: QuizItem[];
  practices: PracticeItem[];
};

const stripCodeFence = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return trimmed;
};

const parseSubtitleFile = (filename: string, content: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.vtt')) {
    return content
      .replace(/^WEBVTT.*$/gim, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/gm, '')
      .replace(/^\d+\s*$/gm, '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  return content
    .replace(/^\d+\s*$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}.*$/gm, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
};

const buildSystemPrompt = (profile: UserProfileType, mode: LearningMode) => {
  const genderLabel = profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '未填写';
  const profileText = [
    `称呼: ${profile.nickname || '未填写'}`,
    `性别: ${genderLabel}`,
    `职业: ${profile.occupation || '未填写'}`,
    `领域: ${profile.domains || '未填写'}`,
    `目标: ${profile.goal}`,
    `深度: ${profile.depth}`,
  ].join('；');

  if (mode === 'note') {
    return `你是本地学习助手。根据用户档案个性化输出结构化笔记（总结、核心概念、关键要点），不要出题。用户档案：${profileText}。只用中文回答。`;
  }

  if (mode === 'quiz') {
    return `你是本地学习助手。根据素材生成测验题，包含基础题（检验是否读懂）和拓展题（举一反三）。不要自动判题。用户档案：${profileText}。严格输出 JSON：{"quizzes":[{"kind":"basic"|"extend","question":"...","answer":"..."}]}`;
  }

  return `你是本地学习助手。根据素材生成 2-4 条可落地实践任务。技术类偏 demo/改参数/对比写法；通用类偏场景应用。用户档案：${profileText}。严格输出 JSON：{"practices":[{"task":"..."}]}`;
};

const callChatCompletion = async (settings: LlmSettingsType, messages: ChatMessage[]): Promise<string> => {
  if (!settings.apiKey) {
    throw new Error('请先在设置页填写 API Key');
  }
  if (!settings.baseUrl) {
    throw new Error('请先配置接口地址');
  }

  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`模型请求失败 (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('模型未返回有效内容');
  }
  return content;
};

/** 流式对话：优先 SSE；不支持时回退整段 + 本地逐字回调 */
const callChatCompletionStream = async (
  settings: LlmSettingsType,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> => {
  if (!settings.apiKey) {
    throw new Error('请先在设置页填写 API Key');
  }
  if (!settings.baseUrl) {
    throw new Error('请先配置接口地址');
  }

  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.7,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    // 部分兼容接口不支持 stream，回退普通请求再本地逐字
    const fallback = await callChatCompletion(settings, messages);
    await typewriterEmit(fallback, onDelta, signal);
    return fallback;
  }

  const contentType = response.headers.get('content-type') || '';
  const canTrySse = Boolean(
    response.body &&
      (contentType.includes('text/event-stream') ||
        contentType.includes('octet-stream') ||
        contentType.includes('text/plain') ||
        !contentType.includes('application/json')),
  );

  if (canTrySse && response.body) {
    const full = await readSseChatStream(response.body, onDelta, signal);
    if (full.trim()) {
      return full;
    }
    // body 已读完仍无有效增量：另发非流式请求再本地逐字
    const fallback = await callChatCompletion(settings, messages);
    await typewriterEmit(fallback, onDelta, signal);
    return fallback;
  }

  // 明确 JSON 响应：整段后再本地逐字
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('模型未返回有效内容');
  }
  await typewriterEmit(content, onDelta, signal);
  return content;
};

const readSseChatStream = async (
  body: ReadableStream<Uint8Array>,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') {
        continue;
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const piece = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? '';
        if (piece) {
          full += piece;
          onDelta(piece);
        }
      } catch {
        // 忽略残缺 SSE 行
      }
    }
  }

  return full;
};

const typewriterEmit = async (text: string, onDelta: (chunk: string) => void, signal?: AbortSignal) => {
  const chars = Array.from(text);
  // 小块输出，便于上层蓄水池尽快达到阈值并结束 loading
  const chunkSize = 4;
  for (let i = 0; i < chars.length; i += chunkSize) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const piece = chars.slice(i, i + chunkSize).join('');
    onDelta(piece);
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, piece.includes('\n') ? 24 : 12);
    });
  }
};

const generateLearningContent = async ({
  settings,
  profile,
  mode,
  material,
}: {
  settings: LlmSettingsType;
  profile: UserProfileType;
  mode: LearningMode;
  material: string;
}): Promise<GeneratedContent> => {
  const content = await callChatCompletion(settings, [
    { role: 'system', content: buildSystemPrompt(profile, mode) },
    { role: 'user', content: `学习素材如下：\n\n${material.slice(0, 24000)}` },
  ]);

  if (mode === 'note') {
    return { noteContent: content, quizzes: [], practices: [] };
  }

  try {
    const parsed = JSON.parse(stripCodeFence(content)) as {
      quizzes?: Array<{ kind?: string; question?: string; answer?: string }>;
      practices?: Array<{ task?: string }>;
    };

    if (mode === 'quiz') {
      const quizzes: QuizItem[] = (parsed.quizzes ?? []).map((item, index) => ({
        id: `quiz-${Date.now()}-${index}`,
        kind: item.kind === 'extend' ? 'extend' : 'basic',
        question: item.question ?? '',
        answer: item.answer ?? '',
        userAnswer: '',
      }));
      return { noteContent: '', quizzes, practices: [] };
    }

    const practices: PracticeItem[] = (parsed.practices ?? []).map((item, index) => ({
      id: `practice-${Date.now()}-${index}`,
      task: item.task ?? '',
      userResult: '',
    }));
    return { noteContent: '', quizzes: [], practices };
  } catch {
    if (mode === 'quiz') {
      return {
        noteContent: '',
        quizzes: [
          {
            id: `quiz-${Date.now()}`,
            kind: 'basic',
            question: content,
            answer: '',
            userAnswer: '',
          },
        ],
        practices: [],
      };
    }

    return {
      noteContent: '',
      quizzes: [],
      practices: [
        {
          id: `practice-${Date.now()}`,
          task: content,
          userResult: '',
        },
      ],
    };
  }
};

export { parseSubtitleFile, callChatCompletion, callChatCompletionStream, generateLearningContent };
