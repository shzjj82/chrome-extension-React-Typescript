import { t } from '@extension/i18n';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { shouldPromptPetAdoption } from '@extension/storage';
import type { PetInteractionAction } from '../types';
import type { UserProfileType } from '@extension/storage';

const createStudyMindHoverActions = (): PetInteractionAction[] => [
  {
    id: 'study',
    label: t('petActionStudy'),
    title: t('petActionStudyTitle'),
    ariaLabel: t('petActionStudy'),
    onSelect: () => {
      void sendExtensionMessage(ExtensionMessageType.START_LEARNING);
    },
  },
  {
    id: 'rest',
    label: t('petActionRest'),
    title: t('petActionRestTitle'),
    ariaLabel: t('petActionRest'),
    onSelect: () => {
      void sendExtensionMessage(ExtensionMessageType.POMODORO_START_BREAK);
    },
  },
];

/** 专注中 hover：暂停休息 / 结束；移开后继续保持专注 */
const createFocusHoverActions = (): PetInteractionAction[] => [
  {
    id: 'focus-pause',
    label: t('petFocusPause'),
    title: t('petFocusPauseTitle'),
    ariaLabel: t('petFocusPause'),
    onSelect: () => {
      void sendExtensionMessage(ExtensionMessageType.POMODORO_START_BREAK);
    },
  },
  {
    id: 'focus-end',
    label: t('petFocusEnd'),
    title: t('petFocusEndTitle'),
    ariaLabel: t('petFocusEnd'),
    onSelect: () => {
      void sendExtensionMessage(ExtensionMessageType.POMODORO_STOP);
    },
  },
];

const createRestReminderAction = (onDismiss: () => void): PetInteractionAction => ({
  id: 'rest-reminder',
  label: t('petRestReminder'),
  headLine: t('petRestReminderHead'),
  actionText: t('petRestReminderAction'),
  trailingText: t('petRestReminderTrailing'),
  title: t('petRestReminderTitle'),
  ariaLabel: t('petRestReminderAction'),
  onSelect: () => {
    onDismiss();
  },
});

/** 每 5 分钟：按百分比汇报已走过的专注时间 */
const createFocusProgressAction = (elapsedMinutes: number, percent: number): PetInteractionAction => ({
  id: 'focus-progress',
  label: t('petFocusProgressOk'),
  headLine: t('petFocusProgressHead'),
  actionText: `${percent}%`,
  trailingText: `（${elapsedMinutes}${t('petFocusProgressMinutes')}）`,
  title: t('petFocusProgressTitle'),
  ariaLabel: t('petFocusProgressOk'),
  onSelect: () => undefined,
});

const createStudyMindAdoptAction = (): PetInteractionAction => ({
  id: 'adopt',
  label: t('petActionAdopt'),
  headLine: t('petActionAdoptHead'),
  tailPrefix: t('petActionAdoptTailPrefix'),
  actionText: t('petActionAdoptAction'),
  trailingText: t('petActionAdoptTrailing'),
  title: t('petActionAdoptTitle'),
  ariaLabel: t('petActionAdopt'),
  onSelect: () => {
    void sendExtensionMessage(ExtensionMessageType.OPEN_SIDE_PANEL);
  },
});

const createStudyMindPetHoverActions = (profile: UserProfileType): PetInteractionAction[] =>
  shouldPromptPetAdoption(profile) ? [createStudyMindAdoptAction()] : createStudyMindHoverActions();

export {
  createStudyMindAdoptAction,
  createStudyMindHoverActions,
  createStudyMindPetHoverActions,
  createFocusHoverActions,
  createRestReminderAction,
  createFocusProgressAction,
};
