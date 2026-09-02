import '@src/Popup.css';
import { t } from '@extension/i18n';
import {
  ExtensionMessageType,
  sendExtensionMessage,
  useStorage,
  withErrorBoundary,
  withSuspense,
} from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { Button, cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);

  const openSidePanel = async () => {
    // Must call sidePanel.open in the same user-gesture turn (popup click).
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return;
    }

    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'side-panel/index.html',
      enabled: true,
    });
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  };

  const startLearning = async () => {
    await sendExtensionMessage(ExtensionMessageType.START_LEARNING);
    window.close();
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'dark bg-gray-900')}>
      <header className={cn('App-header gap-3 px-4 py-5', isLight ? 'text-gray-900' : 'text-gray-100')}>
        <h1 className="text-lg font-semibold">Study Mind AI</h1>
        <p className="text-sm opacity-80">本地私有化 AI 学习助手</p>
        <Button className="mt-2 w-full" onClick={() => void startLearning()}>
          {t('startLearning')}
        </Button>
        <Button className="w-full" variant="secondary" onClick={() => void openSidePanel()}>
          {t('openSidePanel')}
        </Button>
        <Button className="w-full" variant="secondary" onClick={openOptions}>
          {t('openOptions')}
        </Button>
        <Button className="w-full" variant="outline" onClick={() => void exampleThemeStorage.toggle()}>
          {t('toggleTheme')}
        </Button>
      </header>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
