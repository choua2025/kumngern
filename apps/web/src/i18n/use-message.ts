import { parseMessage } from '@income-expenses/shared';
import { useTranslation } from 'react-i18next';
import { i18n } from './index';

/**
 * Messages may be translation keys — with parameters, "validation.tooLong?max=255" — from
 * the web's own forms, the shared Zod schemas or the API (error.key / details[].key).
 * Keys are translated; anything else (e.g. a Zod default message) is shown as it is.
 */
export function translateMessage(message: string): string {
  const { key, params } = parseMessage(message);
  // Dynamic key: i18next's typed overloads cannot know it, so use the untyped exists/t.
  const t = i18n.t as unknown as (key: string, options?: Record<string, string>) => string;
  return i18n.exists(key) ? t(key, params) : message;
}

export function useMessage(): (message: string | undefined) => string | undefined {
  // Subscribes the component to language changes.
  useTranslation();
  return (message) => (message === undefined ? undefined : translateMessage(message));
}
