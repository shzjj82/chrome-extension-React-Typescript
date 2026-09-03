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
];

/** 暂停 / 休息中：恢复专注（不是重新「专注」） */
const createResumeFocusHoverActions = (): PetInteractionAction[] => [
  {
    id: 'resume-focus',
    label: t('petActionResumeFocus'),
    title: t('petActionResumeFocusTitle'),
    ariaLabel: t('petActionResumeFocus'),
    onSelect: () => {
      void sendExtensionMessage(ExtensionMessageType.POMODORO_START);
    },
  },
];

/** 专注中 hover：云朵内两行 —— 已专注 xx 分钟 / 休息 or 结束（不拆成多段以免挤进圆点） */
const createFocusHoverActions = (elapsedMinutes: number): PetInteractionAction[] => {
  const minutes = Math.max(0, Math.floor(elapsedMinutes));
  return [
    {
      id: 'focus-status',
      label: t('petActionRest'),
      headLine: t('petFocusElapsedHead', String(minutes)),
      actionText: t('petActionRest'),
      secondaryActionText: t('petFocusEnd'),
      title: t('petActionRestTitle'),
      ariaLabel: t('petActionRest'),
      secondaryTitle: t('petFocusEndTitle'),
      secondaryAriaLabel: t('petFocusEnd'),
      onSelect: () => {
        void sendExtensionMessage(ExtensionMessageType.POMODORO_START_BREAK);
      },
      onSecondarySelect: () => {
        void sendExtensionMessage(ExtensionMessageType.POMODORO_STOP);
      },
    },
  ];
};

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
  createResumeFocusHoverActions,
  createFocusHoverActions,
  createRestReminderAction,
  createFocusProgressAction,
};
