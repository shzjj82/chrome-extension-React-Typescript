import '@src/index.css';
import { bootstrapInitialEntry } from '@src/lib/routes';
import SidePanel from '@src/SidePanel';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const init = () => {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(
    <MemoryRouter initialEntries={[bootstrapInitialEntry()]}>
      <SidePanel />
    </MemoryRouter>,
  );
};

init();
