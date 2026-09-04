import { t } from '@extension/i18n';
import { ExtensionMessageType, sendExtensionMessage } from '@extension/shared';
import { shouldPromptPetAdoption } from '@extension/storage';
import type { PetInteractionAction } from '../types';
import type { FocusDaySummary, UserProfileType } from '@extension/storage';

const createStudyMindHoverActions = (): PetInteractionAction[] => [
  {
    id: 'study',
    label: t('petActionStudy'),
    title: t('petActionStudyTitle'),
    ariaLabel: t('petActionStudy'),
    onSelect: () => {
      // 专注：只启动番茄，不打开侧边栏
      void sendExtensionMessage(ExtensionMessageType.POMODORO_START);
    },
  },
  {
    id: 'organize',
    label: t('petActionOrganize'),
    title: t('petActionOrganizeTitle'),
    ariaLabel: t('petActionOrganize'),
    onSelect: () => {
      void sendExtensionMessage(ExtensionMessageType.OPEN_SIDE_PANEL, { view: 'browse' });
    },
  },
];

/** 今日已有计入的专注日志：在专注/整理之外展示今日摘要 */
const createTodayFocusSummaryAction = (summary: FocusDaySummary): PetInteractionAction => {
  const minutes = Math.max(0, Math.round(summary.countedMs / 60_000));
  return {
    id: 'today-focus',
    label: t('petActionTodayFocus'),
    headLine: t('petTodayFocusHead'),
    actionText: t('petTodayFocusCount', String(summary.countedCount)),
    trailingText: t('petTodayFocusMinutes', String(minutes)),
    title: t('petActionTodayFocusTitle'),
    ariaLabel: t('petActionTodayFocus'),
    onSelect: () => undefined,
  };
};

const createIdlePetHoverActions = (summary: FocusDaySummary | null): PetInteractionAction[] => {
  const base = createStudyMindHoverActions();
  if (!summary || summary.countedCount <= 0) {
    return base;
  }
  return [...base, createTodayFocusSummaryAction(summary)];
};

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

/** 专注中 hover：状态文案 + 休息/结束；换行由文案与气泡宽度决定 */
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

/** 中途结束：询问是否将本次浏览加入整理 */
const createOrganizeAskAction = (onDone: () => void): PetInteractionAction => ({
  id: 'organize-ask',
  label: t('petOrganizeAsk'),
  headLine: t('petOrganizeAskHead'),
  actionText: t('petOrganizeAskAccept'),
  secondaryActionText: t('petOrganizeAskDismiss'),
  title: t('petOrganizeAskTitle'),
  ariaLabel: t('petOrganizeAskAccept'),
  secondaryTitle: t('petOrganizeAskDismiss'),
  secondaryAriaLabel: t('petOrganizeAskDismiss'),
  onSelect: () => {
    onDone();
    void sendExtensionMessage(ExtensionMessageType.FOCUS_ORGANIZE_ACCEPT);
  },
  onSecondarySelect: () => {
    onDone();
    void sendExtensionMessage(ExtensionMessageType.FOCUS_ORGANIZE_DISMISS);
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

const createStudyMindPetHoverActions = (
  profile: UserProfileType,
  todaySummary: FocusDaySummary | null = null,
): PetInteractionAction[] =>
  shouldPromptPetAdoption(profile) ? [createStudyMindAdoptAction()] : createIdlePetHoverActions(todaySummary);

export {
  createStudyMindAdoptAction,
  createStudyMindHoverActions,
  createStudyMindPetHoverActions,
  createIdlePetHoverActions,
  createTodayFocusSummaryAction,
  createResumeFocusHoverActions,
  createFocusHoverActions,
  createRestReminderAction,
  createFocusProgressAction,
  createOrganizeAskAction,
};
