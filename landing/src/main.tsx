// Landing page entry point (feature 007).
//
// `hydrateRoot`, not `createRoot`: the served HTML is real markup produced by
// `prerender.ts`, so React attaches to it rather than discarding and rebuilding
// it. Using createRoot here would blank the prerendered content for a frame and
// throw away the reason the prerender exists.
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import '@svtrip/core/i18n';
import './styles/index.css';
import { App } from './App';
import { BusinessPage } from './business/BusinessPage';
import { isBusinessPath } from './business/paths';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

hydrateRoot(
  root,
  <StrictMode>
    {/* The same document per path the prerender wrote (feature 025): the business page hydrates
        the business page, or React would replace the prerendered HTML with the landing. */}
    {isBusinessPath(window.location.pathname) ? <BusinessPage /> : <App />}
  </StrictMode>,
);
