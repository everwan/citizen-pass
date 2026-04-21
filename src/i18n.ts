import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const language = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';

void i18n.use(initReactI18next).init({
  lng: language,
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: {
        home: 'Home',
      },
    },
    zh: {
      translation: {
        home: '首页',
      },
    },
  },
});

export default i18n;
