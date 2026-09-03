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
  createRestReminderAction,
};
