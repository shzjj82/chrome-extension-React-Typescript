import { StudyPet } from './StudyPet';
import { useStorage } from '@extension/shared';
import { uiSettingsStorage } from '@extension/storage';

export default function App() {
  const uiSettings = useStorage(uiSettingsStorage);

  if (!uiSettings.floatBallEnabled) {
    return null;
  }

  return <StudyPet enabled />;
}
