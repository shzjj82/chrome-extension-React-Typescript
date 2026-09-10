import type { KnowledgeDepth, LearningGoal, UserProfileType } from '@extension/storage';

const GOAL_LABEL: Record<LearningGoal, string> = {
  principle: '偏原理理解',
  exam: '偏考试应试',
  application: '偏落地应用',
};

const DEPTH_LABEL: Record<KnowledgeDepth, string> = {
  shallow: '浅层概览',
  normal: '适中深度',
  deep: '深入细节',
};

const goalLabel = (goal: LearningGoal) => GOAL_LABEL[goal];
const depthLabel = (depth: KnowledgeDepth) => DEPTH_LABEL[depth];

/** 各通道共用的用户档案段落 */
const formatProfileBlock = (profile: UserProfileType) => {
  const name = profile.nickname.trim() || '学习者';
  const occupation = profile.occupation.trim() || '未填写';
  const domains = profile.domains.trim() || '未填写';
  return [
    '【用户档案】',
    `称呼：${name}`,
    `职业：${occupation}`,
    `关注领域：${domains}`,
    `学习目标：${goalLabel(profile.goal)}`,
    `讲解深度：${depthLabel(profile.depth)}`,
  ].join('\n');
};

const profileDisplayName = (profile: UserProfileType) => profile.nickname.trim() || '你';

export { GOAL_LABEL, DEPTH_LABEL, goalLabel, depthLabel, formatProfileBlock, profileDisplayName };
