import inlineCss from '../../../dist/all/index.css?inline';
import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/all/App';
import { Suspense } from 'react';

initAppWithShadow({
  id: 'CEB-extension-all',
  app: (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  ),
  inlineCss,
});
