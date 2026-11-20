import './platform/install';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../../src/components/error-boundary';
import { WebApp } from './WebApp';
import { ensureHostSession } from './platform/host-auth';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('CineGen web root element was not found.');
}

const root = createRoot(rootElement);

ensureHostSession().then(
  () => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <WebApp />
        </ErrorBoundary>
      </StrictMode>,
    );
  },
  (error: unknown) => {
    root.render(
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        {error instanceof Error ? error.message : 'Sign in to SmartVideo to use CineGen.'}
      </div>,
    );
  },
);
