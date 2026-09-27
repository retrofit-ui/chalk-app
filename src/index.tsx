/* @refresh reload */
import { render } from 'solid-js/web';
import 'katex/dist/katex.min.css';

import { configureMarked } from '@retrofit-ui/spa-solid-shoelace/components';
import markedKatex from 'marked-katex-extension';

import { IS_ARTIFACT } from './target';
import { hydrate } from './storage';

if (import.meta.env.DEV) {
  // Dev-only: keeps the devtools bridge (and its global) out of both production bundles.
  await import('solid-devtools');
}

configureMarked(markedKatex({ throwOnError: false, output: 'html' }));

import './index.css';
import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// The artifact runtime's storage is async; load it before the first render so the app's
// synchronous storage reads see persisted conversations.
if (IS_ARTIFACT) await hydrate();

render(() => <App />, root!);
