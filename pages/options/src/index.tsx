import '@src/index.css';
import Options from '@src/Options';
import { createRoot } from 'react-dom/client';

const init = () => {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(<Options />);

  // popup 设置图标带 #llm 打开时，滚到大模型配置区
  const scrollToHash = () => {
    const id = window.location.hash.replace(/^#/, '');
    if (!id) {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  scrollToHash();
  window.addEventListener('hashchange', scrollToHash);
};

init();
