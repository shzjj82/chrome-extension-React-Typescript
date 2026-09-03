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

export { parseSubtitleFile, callChatCompletion, generateLearningContent };
