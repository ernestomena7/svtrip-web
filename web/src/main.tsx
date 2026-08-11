// Desktop web application entry point (feature 007).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@svtrip/core/i18n';
import { AuthProvider } from '@svtrip/core/auth/AuthProvider';
import './styles/index.css';
import { Router } from './app/Router';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <Router />
    </AuthProvider>
  </StrictMode>,
);
