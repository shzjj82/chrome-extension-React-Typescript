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
import type { LearningModePreference, LlmProviderId } from '@extension/storage';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const pomodoro = useStorage(pomodoroSettingsStorage);
  const ui = useStorage(uiSettingsStorage);
  const [savedHint, setSavedHint] = useState('');
  // 文本本地草稿，避免 liveUpdate 打断中文输入
  const [nickname, setNickname] = useState(profile.nickname);
  const [gender, setGender] = useState(profile.gender || 'male');
  const [occupation, setOccupation] = useState(profile.occupation);
  const [domains, setDomains] = useState(profile.domains);

  const adoptionDraft = { ...profile, nickname, gender, occupation };

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
    <div className={cn('options-shell', !isLight && 'options-shell--dark')}>
      <div className="options-shell__inner">
        <header className="options-shell__header">
          <h1 className="options-shell__brand">Study Mind · {t('openOptions')}</h1>
          <p className="options-shell__hint">{t('riskPrivacy')}</p>
          {savedHint ? <p className="options-shell__flash">{savedHint}</p> : null}
        </header>

        <section className="sm-card adopt-section">
          <div className="adopt-section__hero">
            <div className="adopt-section__pet" aria-hidden="true" />
            <div>
              <p className="adopt-section__eyebrow">{t('adoptEyebrow')}</p>
              <h2 className="adopt-section__title">{t('userInfoTitle')}</h2>
              <p className="adopt-section__hint">{t('userInfoHint')}</p>
            </div>
          </div>
          <label className="adopt-field">
            <span className="adopt-field__label">{t('profileNickname')}</span>
            <input
              className="adopt-field__input"
              value={nickname}
              onChange={event => setNickname(event.target.value)}
              placeholder={t('profileNicknamePlaceholder')}
            />
          </label>
          <div className="adopt-field">
            <span className="adopt-field__label">{t('profileGender')}</span>
            <div className="adopt-gender" role="group" aria-label={t('profileGender')}>
              {(
                [
                  ['male', 'profileGenderMale'],
                  ['female', 'profileGenderFemale'],
                ] as const
              ).map(([value, labelKey]) => {
                const selected = gender === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={cn('adopt-gender__chip', selected && 'adopt-gender__chip--active')}
                    aria-pressed={selected}
                    onClick={() => setGender(value)}>
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="adopt-field">
            <span className="adopt-field__label">{t('profileOccupation')}</span>
            <input
              className="adopt-field__input"
              value={occupation}
              onChange={event => setOccupation(event.target.value)}
              placeholder={t('profileOccupationPlaceholder')}
            />
          </label>
          <div className="flex gap-2">
            <Button
              className="adopt-section__cta"
              disabled={!isAdoptionUserInfoFilled(adoptionDraft)}
              onClick={() => {
                if (!isAdoptionUserInfoFilled(adoptionDraft)) {
                  return;
                }
                void userProfileStorage.set(prev => ({
                  ...prev,
                  nickname: nickname.trim(),
                  gender,
                  occupation: occupation.trim(),
                  petAdopted: true,
                  onboardingCompleted: true,
                }));
                flash(t('adoptSavedHint'));
              }}>
              {t('adoptConfirm')}
            </Button>
          </div>
        </section>

        <section className="sm-card">
          <h2 className="sm-card__title">{t('profileTitle')}</h2>
          <label>
            {t('profileDomains')}
            <input
              value={domains}
              onChange={event => setDomains(event.target.value)}
              placeholder="前端 / 算法 / 产品..."
            />
          </label>
          <label>
            {t('profileGoal')}
            <select
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
          <label>
            {t('profileDepth')}
            <select
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
          <div className="space-y-2 text-sm font-medium text-[color:var(--sm-ink)]">
            <p className="font-bold text-[color:var(--sm-muted)]">{t('profileModes')}</p>
            {(['note', 'quiz', 'practice'] as LearningModePreference[]).map(mode => (
              <label key={mode} className="mr-4 inline-flex flex-row items-center gap-2 font-medium">
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
              className="sm-card__cta"
              onClick={() => {
                void userProfileStorage.set(prev => ({
                  ...prev,
                  domains: domains.trim(),
                  onboardingCompleted: true,
                }));
                flash(t('profileSave'));
              }}>
              {t('profileSave')}
            </Button>
          </div>
        </section>

        <section className="sm-card">
          <h2 className="sm-card__title">{t('llmTitle')}</h2>
          <label>
            {t('llmProvider')}
            <select
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
          <label>
            {t('llmBaseUrl')}
            <input
              value={llm.baseUrl}
              onChange={event => void llmSettingsStorage.set(prev => ({ ...prev, baseUrl: event.target.value }))}
            />
          </label>
          <label>
            {t('llmModel')}
            <input
              value={llm.model}
              onChange={event => void llmSettingsStorage.set(prev => ({ ...prev, model: event.target.value }))}
            />
          </label>
          <label>
            {t('llmApiKey')}
            <input
              type="password"
              value={llm.apiKey}
              onChange={event => void llmSettingsStorage.set(prev => ({ ...prev, apiKey: event.target.value }))}
              placeholder="仅保存在本地"
            />
          </label>
          <Button className="sm-card__cta" onClick={() => flash('模型设置已保存')}>
            {t('llmSave')}
          </Button>
        </section>

        <section className="sm-card">
          <h2 className="sm-card__title">{t('pomodoroTitle')}</h2>
          <label>
            {t('pomodoroFocus')}
            <input
              type="number"
              min={1}
              value={pomodoro.focusMinutes}
              onChange={event =>
                void pomodoroSettingsStorage.set(prev => ({
                  ...prev,
                  focusMinutes: Number(event.target.value) || 40,
                }))
              }
            />
          </label>
          <label>
            {t('pomodoroBreak')}
            <input
              type="number"
              min={1}
              value={pomodoro.breakMinutes}
              onChange={event =>
                void pomodoroSettingsStorage.set(prev => ({
                  ...prev,
                  breakMinutes: Number(event.target.value) || 10,
                }))
              }
            />
          </label>
          <label className="inline-flex flex-row items-center gap-2 font-medium text-[color:var(--sm-ink)]">
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
          <Button className="sm-card__cta" onClick={() => flash('设置已保存')}>
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
