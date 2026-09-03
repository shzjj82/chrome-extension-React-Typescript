import { t } from '@extension/i18n';
import { isAdoptionUserInfoFilled, userProfileStorage } from '@extension/storage';
import { Button, cn } from '@extension/ui';
import { useState } from 'react';
import type { UserGender, UserProfileType } from '@extension/storage';

type AdoptionPanelProps = {
  profile: UserProfileType;
  isLight: boolean;
  onAdopted: () => void;
};

const GENDER_OPTIONS: { value: UserGender; labelKey: 'profileGenderMale' | 'profileGenderFemale' }[] = [
  { value: 'male', labelKey: 'profileGenderMale' },
  { value: 'female', labelKey: 'profileGenderFemale' },
];

const AdoptionPanel = ({ profile, isLight, onAdopted }: AdoptionPanelProps) => {
  // 本地草稿：避免每键写入 storage 触发重渲染，打断中文输入法
  const [nickname, setNickname] = useState(profile.nickname);
  const [gender, setGender] = useState<UserGender>(profile.gender || 'male');
  const [occupation, setOccupation] = useState(profile.occupation);

  const draft = { ...profile, nickname, gender, occupation };
  const canAdopt = isAdoptionUserInfoFilled(draft);

  return (
    <div className={cn('adopt-panel', isLight ? 'adopt-panel--light' : 'adopt-panel--dark')}>
      <div className="adopt-panel__glow" aria-hidden="true" />

      <header className="adopt-panel__hero">
        <div className="adopt-panel__pet" aria-hidden="true" />
      </header>

      <section className="adopt-panel__card">
        <div className="adopt-panel__heading">
          <p className="adopt-panel__eyebrow">{t('adoptEyebrow')}</p>
          <h2 className="adopt-panel__title">{t('adoptTitle')}</h2>
          <p className="adopt-panel__hint">{t('adoptHint')}</p>
        </div>

        <label className="adopt-field">
          <span className="adopt-field__label">{t('profileNickname')}</span>
          <input
            className="adopt-field__input"
            placeholder={t('profileNicknamePlaceholder')}
            value={nickname}
            onChange={event => setNickname(event.target.value)}
          />
        </label>

        <div className="adopt-field">
          <span className="adopt-field__label">{t('profileGender')}</span>
          <div className="adopt-gender" role="group" aria-label={t('profileGender')}>
            {GENDER_OPTIONS.map(option => {
              const selected = gender === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn('adopt-gender__chip', selected && 'adopt-gender__chip--active')}
                  aria-pressed={selected}
                  onClick={() => setGender(option.value)}>
                  {t(option.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <label className="adopt-field">
          <span className="adopt-field__label">{t('profileOccupation')}</span>
          <input
            className="adopt-field__input"
            placeholder={t('profileOccupationPlaceholder')}
            value={occupation}
            onChange={event => setOccupation(event.target.value)}
          />
        </label>

        <Button
          className="adopt-panel__cta"
          disabled={!canAdopt}
          onClick={() => {
            if (!canAdopt) {
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
            onAdopted();
          }}>
          {t('adoptConfirm')}
        </Button>
      </section>
    </div>
  );
};

export default AdoptionPanel;
