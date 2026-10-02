import { useTranslation } from 'react-i18next';
import { i18n } from './index';

/**
 * Validation messages may be translation KEYS ("validation.selectWallet") or plain text
 * (e.g. an API message). Keys are translated; anything else is shown as it is. This lets
 * forms move to keys one by one without breaking the ones that still pass text.
 */
export function translateMessage(message: string): string {
  // Dynamic key: i18next's typed overloads cannot know it, so use the untyped exists/t.
  const t = i18n.t as unknown as (key: string) => string;
  return i18n.exists(message) ? t(message) : message;
}

export function useMessage(): (message: string | undefined) => string | undefined {
  // Subscribes the component to language changes.
  useTranslation();
  return (message) => (message === undefined ? undefined : translateMessage(message));
}
