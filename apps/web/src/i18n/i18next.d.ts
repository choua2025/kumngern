import 'i18next';
import type { en } from './locales/en';

// Typed keys: t('wallets.add') autocompletes, and a typo is a compile error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
    returnNull: false;
  }
}
