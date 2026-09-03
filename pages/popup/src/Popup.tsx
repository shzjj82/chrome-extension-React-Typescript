import '@src/Popup.css';
import { t } from '@extension/i18n';
import {
  ExtensionMessageType,
  sendExtensionMessage,
  useStorage,
  withErrorBoundary,
  withSuspense,
} from '@extension/shared';
import { exampleThemeStorage, normalizePetStats, petStatsStorage } from '@extension/storage';
import { Button, cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import type { PetStatsType, BaseStorageType } from '@extension/storage';

type PetStatBarProps = {
  label: string;
  value: number;
  tone: 'hunger' | 'mood' | 'growth';
};

const PetStatBar = ({ label, value, tone }: PetStatBarProps) => {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('App__stat', `App__stat--${tone}`)}>
      <div className="App__stat-meta">
        <span className="App__stat-label">{label}</span>
        <span className="App__stat-value">{safe}%</span>
      </div>
      <div
        className="App__stat-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}>
        <div className="App__stat-fill" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
};

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const rawPetStats = useStorage(petStatsStorage as BaseStorageType<PetStatsType>);
  const petStats = normalizePetStats(rawPetStats);

  const startLearning = async () => {
    await sendExtensionMessage(ExtensionMessageType.START_LEARNING);
    window.close();
  };

  const openLlmSettings = () => {
    const url = chrome.runtime.getURL('options/index.html#llm');
    void chrome.tabs.create({ url });
    window.close();
  };

  return (
    <div className={cn('App', !isLight && 'App--dark')}>
      <header className="App-header">
        <div className="App__top">
          <div className="App__pet" aria-hidden="true" />
          <button
            type="button"
            className="App__settings"
            title={t('openLlmSettings')}
            aria-label={t('openLlmSettings')}
            onClick={openLlmSettings}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.66a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              />
            </svg>
          </button>
        </div>

        <h1 className="App__brand">Study Mind</h1>
        <p className="App__tagline">陪伴式学习伙伴，陪你专注与休息</p>

        <Button className="App__cta w-full" onClick={() => void startLearning()}>
          {t('startLearning')}
        </Button>

        <section className="App__stats" aria-label={t('petStatsTitle')}>
          <PetStatBar label={t('petStatHunger')} value={petStats.hunger} tone="hunger" />
          <PetStatBar label={t('petStatMood')} value={petStats.mood} tone="mood" />
          <PetStatBar label={t('petStatGrowth')} value={petStats.growth} tone="growth" />
        </section>
      </header>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
