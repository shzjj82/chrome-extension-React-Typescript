import { FloatingPet, createStudyMindPetHoverActions, defaultBounds, VIEW_SIZE } from './pet';
import { useStorage } from '@extension/shared';
import { normalizeUserProfile, userProfileStorage } from '@extension/storage';
import { useCallback } from 'react';
import type { FloatingPetProps, PetBounds } from './pet';

type StudyPetProps = Omit<FloatingPetProps, 'resolveBubbleActions' | 'ariaLabel'>;

const StudyPet = (props: StudyPetProps) => {
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const resolveBubbleActions = useCallback(() => createStudyMindPetHoverActions(profile), [profile]);

  return <FloatingPet {...props} resolveBubbleActions={resolveBubbleActions} ariaLabel="Study Mind 学习伙伴" />;
};

export type { PetBounds as Bounds, StudyPetProps };
export { StudyPet, VIEW_SIZE, defaultBounds };
