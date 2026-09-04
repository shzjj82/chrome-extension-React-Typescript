import '@src/Options.css';
import SmSelect from './SmSelect';
import SmSwitch from './SmSwitch';
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
import { useEffect, useState } from 'react';
import type { LearningModePreference, LlmProviderId } from '@extension/storage';

type OptionsTab = 'companion' | 'profile' | 'llm' | 'focus';

const TAB_FROM_HASH: Record<string, OptionsTab> = {
  companion: 'companion',
  profile: 'profile',
  llm: 'llm',
  focus: 'focus',
  pomodoro: 'focus',
};

const resolveTabFromHash = (): OptionsTab => {
  try {
    const id = window.location.hash.replace(/^#/, '');
    return TAB_FROM_HASH[id] ?? 'companion';
  } catch {
    return 'companion';
  }
};

const OPTIONS_TABS: Array<{ id: OptionsTab; label: string }> = [
  { id: 'companion', label: '关于你' },
  { id: 'profile', label: '学习偏好' },
  { id: 'llm', label: '大模型' },
  { id: 'focus', label: '专注与界面' },
];

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const llm = useStorage(llmSettingsStorage);
  const pomodoro = useStorage(pomodoroSettingsStorage);
  const ui = useStorage(uiSettingsStorage);
  const [tab, setTab] = useState<OptionsTab>(() => resolveTabFromHash());
  const [savedHint, setSavedHint] = useState('');
  // 文本本地草稿，避免 liveUpdate 打断中文输入
  const [nickname, setNickname] = useState(profile.nickname);
  const [gender, setGender] = useState(profile.gender || 'male');
  const [occupation, setOccupation] = useState(profile.occupation);
  const [domains, setDomains] = useState(profile.domains);

  const adoptionDraft = { ...profile, nickname, gender, occupation };

  useEffect(() => {
    const onHash = () => setTab(resolveTabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectTab = (next: OptionsTab) => {
    setTab(next);
    const nextHash = `#${next}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  };

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
          <div className="options-shell__title-row">
            <h1 className="options-shell__brand">Study Mind · {t('openOptions')}</h1>
            <Button variant="outline" size="sm" onClick={() => void exampleThemeStorage.toggle()}>
              {t('toggleTheme')}
            </Button>
          </div>
          <p className="options-shell__hint">{t('riskPrivacy')}</p>
          {savedHint ? <p className="options-shell__flash">{savedHint}</p> : null}
        </header>

        <section className="options-pet-hero" aria-label="陪伴伙伴">
          <div className="options-pet-hero__pet" aria-hidden="true" />
          <div className="options-pet-hero__copy">
            <p className="options-pet-hero__eyebrow">{t('adoptEyebrow')}</p>
            <h2 className="options-pet-hero__title">
              {profile.nickname ? `嗨，${profile.nickname}` : t('userInfoTitle')}
            </h2>
            <p className="options-pet-hero__hint">
              {profile.petAdopted ? '在下方各分类里调整陪伴与学习设置。' : t('userInfoHint')}
            </p>
          </div>
        </section>

        <nav className="options-tabs" aria-label="设置分类">
          {OPTIONS_TABS.map(item => (
            <button
              key={item.id}
              type="button"
              className={cn('options-tabs__chip', tab === item.id && 'options-tabs__chip--active')}
              aria-pressed={tab === item.id}
              onClick={() => selectTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'companion' ? (
          <section className="sm-card adopt-section">
            <h2 className="sm-card__title">{t('userInfoTitle')}</h2>
            <p className="adopt-section__hint">{t('userInfoHint')}</p>
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
            <div className="options-shell__actions">
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
        ) : null}

        {tab === 'profile' ? (
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
              <SmSelect
                aria-label={t('profileGoal')}
                value={profile.goal}
                options={[
                  { value: 'application', label: t('goalApplication') },
                  { value: 'principle', label: t('goalPrinciple') },
                  { value: 'exam', label: t('goalExam') },
                ]}
                onChange={next =>
                  void userProfileStorage.set(prev => ({
                    ...prev,
                    goal: next as typeof profile.goal,
                  }))
                }
              />
            </label>
            <label>
              {t('profileDepth')}
              <SmSelect
                aria-label={t('profileDepth')}
                value={profile.depth}
                options={[
                  { value: 'shallow', label: t('depthShallow') },
                  { value: 'normal', label: t('depthNormal') },
                  { value: 'deep', label: t('depthDeep') },
                ]}
                onChange={next =>
                  void userProfileStorage.set(prev => ({
                    ...prev,
                    depth: next as typeof profile.depth,
                  }))
                }
              />
            </label>
            <div className="sm-mode-field">
              <p className="sm-mode-field__label">{t('profileModes')}</p>
              <div className="sm-mode-field__chips" role="group" aria-label={t('profileModes')}>
                {(['note', 'quiz', 'practice'] as LearningModePreference[]).map(mode => {
                  const selected = profile.preferredModes.includes(mode);
                  const label = mode === 'note' ? t('modeNote') : mode === 'quiz' ? t('modeQuiz') : t('modePractice');
                  return (
                    <button
                      key={mode}
                      type="button"
                      className={cn('sm-mode-field__chip', selected && 'sm-mode-field__chip--active')}
                      aria-pressed={selected}
                      onClick={() => toggleMode(mode)}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="options-shell__actions">
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
        ) : null}

        {tab === 'llm' ? (
          <section className="sm-card" id="llm">
            <h2 className="sm-card__title">{t('llmTitle')}</h2>
            <label>
              {t('llmProvider')}
              <SmSelect
                aria-label={t('llmProvider')}
                value={llm.provider}
                options={[
                  { value: 'deepseek', label: 'DeepSeek' },
                  { value: 'qwen', label: '通义千问' },
                  { value: 'openai-compatible', label: 'OpenAI Compatible' },
                ]}
                onChange={next => {
                  const provider = next as LlmProviderId;
                  void llmSettingsStorage.set(prev => ({
                    ...prev,
                    provider,
                    baseUrl: LLM_PROVIDER_PRESETS[provider].baseUrl,
                    model: LLM_PROVIDER_PRESETS[provider].model,
                  }));
                }}
              />
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
            <div className="options-shell__actions">
              <Button className="sm-card__cta" onClick={() => flash('模型设置已保存')}>
                {t('llmSave')}
              </Button>
            </div>
          </section>
        ) : null}

        {tab === 'focus' ? (
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
            <SmSwitch
              label={t('uiFloatBall')}
              checked={ui.floatBallEnabled}
              onChange={next =>
                void uiSettingsStorage.set(prev => ({
                  ...prev,
                  floatBallEnabled: next,
                }))
              }
            />
            <div className="options-shell__actions">
              <Button className="sm-card__cta" onClick={() => flash('设置已保存')}>
                {t('saveSettings')}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
