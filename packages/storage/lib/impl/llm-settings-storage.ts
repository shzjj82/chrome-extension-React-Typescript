import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type LlmProviderId =
  | 'deepseek'
  | 'qwen'
  | 'openai'
  | 'moonshot'
  | 'zhipu'
  | 'siliconflow'
  | 'openrouter'
  | 'doubao'
  | 'openai-compatible';

type LlmModelOption = {
  value: string;
  label: string;
};

type LlmProviderPreset = {
  label: string;
  baseUrl: string;
  /** 切换厂商时的默认模型 */
  model: string;
  models: LlmModelOption[];
};

type LlmSettingsType = {
  provider: LlmProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
};

type LlmSettingsStorageType = BaseStorageType<LlmSettingsType>;

/** 模型下拉里的「自定义」选项 */
const LLM_CUSTOM_MODEL_VALUE = '__custom__';

const LLM_PROVIDER_PRESETS: Record<LlmProviderId, LlmProviderPreset> = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
    models: [
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { value: 'deepseek-chat', label: 'deepseek-chat（旧）' },
      { value: 'deepseek-reasoner', label: 'deepseek-reasoner（旧）' },
    ],
  },
  qwen: {
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    models: [
      { value: 'qwen-turbo', label: 'Qwen Turbo' },
      { value: 'qwen-plus', label: 'Qwen Plus' },
      { value: 'qwen-max', label: 'Qwen Max' },
      { value: 'qwen-long', label: 'Qwen Long' },
      { value: 'qwen3-turbo', label: 'Qwen3 Turbo' },
      { value: 'qwen3-plus', label: 'Qwen3 Plus' },
      { value: 'qwen3-max', label: 'Qwen3 Max' },
      { value: 'qwq-plus', label: 'QwQ Plus' },
    ],
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'o4-mini', label: 'o4-mini' },
      { value: 'o3-mini', label: 'o3-mini' },
    ],
  },
  moonshot: {
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.5',
    models: [
      { value: 'kimi-k2.5', label: 'Kimi K2.5' },
      { value: 'kimi-k3', label: 'Kimi K3' },
      { value: 'moonshot-v1-8k', label: 'Moonshot V1 8K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot V1 32K' },
      { value: 'moonshot-v1-128k', label: 'Moonshot V1 128K' },
    ],
  },
  zhipu: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    models: [
      { value: 'glm-4-flash', label: 'GLM-4 Flash' },
      { value: 'glm-4-air', label: 'GLM-4 Air' },
      { value: 'glm-4-plus', label: 'GLM-4 Plus' },
      { value: 'glm-4.5-flash', label: 'GLM-4.5 Flash' },
      { value: 'glm-4.5', label: 'GLM-4.5' },
      { value: 'glm-4.6', label: 'GLM-4.6' },
    ],
  },
  siliconflow: {
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    models: [
      { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
      { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' },
      { value: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B' },
      { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5 72B' },
      { value: 'moonshotai/Kimi-K2-Instruct', label: 'Kimi K2 Instruct' },
      { value: 'THUDM/GLM-4-9B-0414', label: 'GLM-4 9B' },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    models: [
      { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
      { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
      { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B' },
    ],
  },
  doubao: {
    label: '豆包 / 火山方舟',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: '',
    models: [],
  },
  'openai-compatible': {
    label: '自定义 OpenAI 兼容',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: [],
  },
};

const LLM_PROVIDER_OPTIONS: LlmModelOption[] = (
  Object.entries(LLM_PROVIDER_PRESETS) as Array<[LlmProviderId, LlmProviderPreset]>
).map(([value, preset]) => ({ value, label: preset.label }));

const storage = createStorage<LlmSettingsType>(
  'llm-settings',
  {
    provider: 'deepseek',
    baseUrl: LLM_PROVIDER_PRESETS.deepseek.baseUrl,
    model: LLM_PROVIDER_PRESETS.deepseek.model,
    apiKey: '',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const isLlmConfigured = (settings: Pick<LlmSettingsType, 'apiKey' | 'baseUrl'>) =>
  Boolean(settings.apiKey?.trim() && settings.baseUrl?.trim());

const getProviderModelOptions = (provider: LlmProviderId): LlmModelOption[] => {
  const preset = LLM_PROVIDER_PRESETS[provider] ?? LLM_PROVIDER_PRESETS['openai-compatible'];
  // 豆包 / 纯自定义：只有手填；其余厂商提供常用预设 + 自定义
  if (preset.models.length === 0) {
    return [{ value: LLM_CUSTOM_MODEL_VALUE, label: '自定义…' }];
  }
  return [...preset.models, { value: LLM_CUSTOM_MODEL_VALUE, label: '自定义…' }];
};

const resolveModelSelectValue = (provider: LlmProviderId, model: string) => {
  const preset = LLM_PROVIDER_PRESETS[provider] ?? LLM_PROVIDER_PRESETS['openai-compatible'];
  if (model && preset.models.some(item => item.value === model)) {
    return model;
  }
  return LLM_CUSTOM_MODEL_VALUE;
};

const llmSettingsStorage: LlmSettingsStorageType = storage;

export type { LlmProviderId, LlmSettingsType, LlmSettingsStorageType, LlmModelOption, LlmProviderPreset };
export {
  LLM_CUSTOM_MODEL_VALUE,
  LLM_PROVIDER_OPTIONS,
  LLM_PROVIDER_PRESETS,
  getProviderModelOptions,
  resolveModelSelectValue,
  llmSettingsStorage,
  isLlmConfigured,
};
