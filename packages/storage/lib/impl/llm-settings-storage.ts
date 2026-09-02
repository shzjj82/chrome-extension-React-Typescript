import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type LlmProviderId = 'deepseek' | 'qwen' | 'openai-compatible';

type LlmSettingsType = {
  provider: LlmProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
};

type LlmSettingsStorageType = BaseStorageType<LlmSettingsType>;

const LLM_PROVIDER_PRESETS: Record<LlmProviderId, Pick<LlmSettingsType, 'baseUrl' | 'model'>> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  'openai-compatible': {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
};

const storage = createStorage<LlmSettingsType>(
  'llm-settings',
  {
    provider: 'deepseek',
    ...LLM_PROVIDER_PRESETS.deepseek,
    apiKey: '',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const llmSettingsStorage: LlmSettingsStorageType = storage;

export type { LlmProviderId, LlmSettingsType, LlmSettingsStorageType };
export { LLM_PROVIDER_PRESETS, llmSettingsStorage };
