// Global i18n (EN/ES). Language switching is synchronous and app-wide (FR-018).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import { useUiStore } from './uiStore';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: useUiStore.getState().language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Keep i18next in sync with the global store.
useUiStore.subscribe((state) => {
  if (i18n.language !== state.language) void i18n.changeLanguage(state.language);
});

export default i18n;
