import '@src/Options.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import {
  exampleThemeStorage,
  isAdoptionUserInfoFilled,
  LLM_PROVIDER_PRESETS,
  llmSettingsStorage,
  normalizeUserProfile,
  pomodoroSettingsStorage,
  uiSettingsStorage,
  userProfileStorage,
} from '@extension/storage';
import { Button, cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState } from 'react';
import type { LearningModePreference, LlmProviderId, UserGender } from '@extension/storage';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const pomodoro = useStorage(pomodoroSettingsStorage);
  const ui = useStorage(uiSettingsStorage);
  const [savedHint, setSavedHint] = useState('');

  const toggleMode = (mode: LearningModePreference) => {
    void userProfileStorage.set(prev => {
      const exists = prev.preferredModes.includes(mode);
      return {
        ...prev,
        preferredModes: exists ? prev.preferredModes.filter(item => item !== mode) : [...prev.preferredModes, mode],
      };
    });
  };

  const flash = (message: string) => {
    setSavedHint(message);
    window.setTimeout(() => setSavedHint(''), 2000);
  };

  return (
    <div
      className={cn('min-h-screen px-6 py-8', isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100')}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Study Mind AI · {t('openOptions')}</h1>
          <p className="text-sm opacity-80">{t('riskPrivacy')}</p>
          {savedHint ? <p className="text-sm text-emerald-600">{savedHint}</p> : null}
        </header>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <h2 className="text-lg font-medium">{t('userInfoTitle')}</h2>
          <p className="text-xs opacity-80">{t('userInfoHint')}</p>
          <label className="block text-sm">
            {t('profileNickname')}
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={profile.nickname}
              onChange={event => void userProfileStorage.set(prev => ({ ...prev, nickname: event.target.value }))}
              placeholder={t('profileNicknamePlaceholder')}
            />
          </label>
          <label className="block text-sm">
            {t('profileGender')}
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={profile.gender}
              onChange={event =>
                void userProfileStorage.set(prev => ({
                  ...prev,
                  gender: event.target.value as UserGender,
                }))
              }>
              <option value="">{t('profileGenderUnset')}</option>
              <option value="male">{t('profileGenderMale')}</option>
              <option value="female">{t('profileGenderFemale')}</option>
              <option value="other">{t('profileGenderOther')}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t('profileOccupation')}
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={profile.occupation}
              onChange={event => void userProfileStorage.set(prev => ({ ...prev, occupation: event.target.value }))}
              placeholder={t('profileOccupationPlaceholder')}
            />
          </label>
          <div className="flex gap-2">
            <Button
              disabled={!isAdoptionUserInfoFilled(profile)}
              onClick={() => {
                if (!isAdoptionUserInfoFilled(profile)) {
                  return;
                }
                void userProfileStorage.set(prev => ({
                  ...prev,
                  onboardingCompleted: true,
                  petAdopted: true,
                }));
                flash(t('adoptSavedHint'));
              }}>
              {t('adoptConfirm')}
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <h2 className="text-lg font-medium">{t('profileTitle')}</h2>
          <label className="block text-sm">
            {t('profileDomains')}
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={profile.domains}
              onChange={event => void userProfileStorage.set(prev => ({ ...prev, domains: event.target.value }))}
              placeholder="前端 / 算法 / 产品..."
            />
          </label>
          <label className="block text-sm">
            {t('profileGoal')}
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={profile.goal}
              onChange={event =>
                void userProfileStorage.set(prev => ({
                  ...prev,
                  goal: event.target.value as typeof profile.goal,
                }))
              }>
              <option value="application">{t('goalApplication')}</option>
              <option value="principle">{t('goalPrinciple')}</option>
              <option value="exam">{t('goalExam')}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t('profileDepth')}
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={profile.depth}
              onChange={event =>
                void userProfileStorage.set(prev => ({
                  ...prev,
                  depth: event.target.value as typeof profile.depth,
                }))
              }>
              <option value="shallow">{t('depthShallow')}</option>
              <option value="normal">{t('depthNormal')}</option>
              <option value="deep">{t('depthDeep')}</option>
            </select>
          </label>
          <div className="space-y-2 text-sm">
            <p>{t('profileModes')}</p>
            {(['note', 'quiz', 'practice'] as LearningModePreference[]).map(mode => (
              <label key={mode} className="mr-4 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.preferredModes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                />
                {mode === 'note' ? t('modeNote') : mode === 'quiz' ? t('modeQuiz') : t('modePractice')}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                void userProfileStorage.set(prev => ({
                  ...prev,
                  onboardingCompleted: true,
                }));
                flash(t('profileSave'));
              }}>
              {t('profileSave')}
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <h2 className="text-lg font-medium">{t('llmTitle')}</h2>
          <label className="block text-sm">
            {t('llmProvider')}
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={llm.provider}
              onChange={event => {
                const provider = event.target.value as LlmProviderId;
                void llmSettingsStorage.set(prev => ({
                  ...prev,
                  provider,
                  baseUrl: LLM_PROVIDER_PRESETS[provider].baseUrl,
                  model: LLM_PROVIDER_PRESETS[provider].model,
                }));
              }}>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">通义千问</option>
              <option value="openai-compatible">OpenAI Compatible</option>
            </select>
          </label>
          <label className="block text-sm">
            {t('llmBaseUrl')}
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={llm.baseUrl}
              onChange={event => void llmSettingsStorage.set(prev => ({ ...prev, baseUrl: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            {t('llmModel')}
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={llm.model}
              onChange={event => void llmSettingsStorage.set(prev => ({ ...prev, model: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            {t('llmApiKey')}
            <input
              type="password"
              className="mt-1 w-full rounded border px-3 py-2"
              value={llm.apiKey}
              onChange={event => void llmSettingsStorage.set(prev => ({ ...prev, apiKey: event.target.value }))}
              placeholder="仅保存在本地"
            />
          </label>
          <Button onClick={() => flash('模型设置已保存')}>{t('llmSave')}</Button>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <h2 className="text-lg font-medium">{t('pomodoroTitle')}</h2>
          <label className="block text-sm">
            {t('pomodoroFocus')}
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-3 py-2"
              value={pomodoro.focusMinutes}
              onChange={event =>
                void pomodoroSettingsStorage.set(prev => ({
                  ...prev,
                  focusMinutes: Number(event.target.value) || 25,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            {t('pomodoroBreak')}
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-3 py-2"
              value={pomodoro.breakMinutes}
              onChange={event =>
                void pomodoroSettingsStorage.set(prev => ({
                  ...prev,
                  breakMinutes: Number(event.target.value) || 5,
                }))
              }
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ui.floatBallEnabled}
              onChange={event =>
                void uiSettingsStorage.set(prev => ({
                  ...prev,
                  floatBallEnabled: event.target.checked,
                }))
              }
            />
            {t('uiFloatBall')}
          </label>
          <Button
            onClick={() => {
              flash('设置已保存');
            }}>
            {t('saveSettings')}
          </Button>
          <Button variant="outline" onClick={() => void exampleThemeStorage.toggle()}>
            {t('toggleTheme')}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
