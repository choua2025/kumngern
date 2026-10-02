import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readPreference, writePreference } from '../lib/storage';
import { en } from './locales/en';
import { lo } from './locales/lo';
import { th } from './locales/th';

export const LOCALES = ['th', 'en', 'lo'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'th';

/** BCP 47 tags for Intl: dates, numbers and currency follow the UI language. */
const INTL_LOCALES: Record<Locale, string> = { th: 'th-TH', en: 'en-US', lo: 'lo-LA' };

const STORAGE_KEY = 'locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Saved choice → the browser's languages ("lo-LA" → lo) → Thai. */
export function detectLocale(
  saved = readPreference(STORAGE_KEY),
  browser: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
): Locale {
  if (isLocale(saved)) return saved;
  for (const tag of browser) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, th: { translation: th }, lo: { translation: lo } },
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  // Resources are bundled, so initialise synchronously: the first render is translated.
  initAsync: false,
  // React already escapes values; escaping twice would show &quot; in names.
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyDocumentLanguage(locale: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
applyDocumentLanguage(i18n.language as Locale);

export function currentLocale(): Locale {
  return isLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LOCALE;
}

/** "th-TH" / "en-US" / "lo-LA" for Intl.DateTimeFormat and Intl.NumberFormat. */
export function intlLocale(): string {
  return INTL_LOCALES[currentLocale()];
}

/**
 * Locale for NUMBERS (money, counts). Lao is pinned to en-US grouping ("1,234,567.50"):
 * Chromium ships no Lao Intl data and silently falls back to en-US, while Firefox/Safari
 * would use CLDR's "1.234.567,50" — pinning keeps every browser identical.
 * (Open question for a native reviewer: dot or comma grouping for Lao users.)
 */
export function intlNumberLocale(): string {
  return currentLocale() === 'lo' ? 'en-US' : intlLocale();
}

export async function setLocale(locale: Locale): Promise<void> {
  writePreference(STORAGE_KEY, locale);
  applyDocumentLanguage(locale);
  await i18n.changeLanguage(locale);
}

export { i18n };
