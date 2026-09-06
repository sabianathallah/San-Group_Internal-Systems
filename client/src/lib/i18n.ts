import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import id from '@/locales/id.json';
import { useLanguageStore } from '@/stores/languageStore';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      id: { translation: id },
    },
    lng: useLanguageStore.getState().language,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// Keep i18next in sync when the language is changed elsewhere (e.g. the
// Header switcher writes to the zustand store, not directly to i18next).
useLanguageStore.subscribe((state, prevState) => {
  if (state.language !== prevState.language) {
    i18n.changeLanguage(state.language);
  }
});

export default i18n;
