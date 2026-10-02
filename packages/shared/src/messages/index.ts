import type { Locale } from '../constants.js';
import { type ServerMessages, serverMessagesEn } from './en.js';
import { serverMessagesLo } from './lo.js';
import { serverMessagesTh } from './th.js';

export { type ServerMessages, serverMessagesEn } from './en.js';
export { serverMessagesLo } from './lo.js';
export { serverMessagesTh } from './th.js';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** "validation.amountInvalid" | "errors.walletNotFound" | … */
export type MessageKey = Leaves<ServerMessages>;
export type ValidationKey = Extract<MessageKey, `validation.${string}`>;
export type ErrorKey = Extract<MessageKey, `errors.${string}`>;
export type MessageParams = Record<string, string | number>;

/** The catalog for a UI language — for server-rendered text such as the CSV export. */
export const serverMessagesByLocale: Record<Locale, ServerMessages> = {
  en: serverMessagesEn,
  th: serverMessagesTh,
  lo: serverMessagesLo,
};

/** Display name of a category: the translated name of a SYSTEM category, else its own name. */
export function categoryDisplayName(
  category: { name: string; systemKey: string | null },
  catalog: ServerMessages,
): string {
  if (!category.systemKey) return category.name;
  const ref = `systemCategories.${category.systemKey}`;
  const translated = formatMessage(ref, catalog);
  return translated === ref ? category.name : translated;
}

/**
 * A message reference as ONE string, so it fits wherever Zod and the API expect a
 * message: "validation.tooLong?max=255". Parameters are URL-encoded after "?".
 */
export function msg(key: MessageKey, params?: MessageParams): string {
  if (!params || Object.keys(params).length === 0) return key;
  const query = new URLSearchParams(
    Object.entries(params).map(([name, value]): [string, string] => [name, String(value)]),
  );
  return `${key}?${query.toString()}`;
}

/** "validation.tooLong?max=255" → { key: "validation.tooLong", params: { max: "255" } } */
export function parseMessage(ref: string): { key: string; params: Record<string, string> } {
  const at = ref.indexOf('?');
  if (at === -1) return { key: ref, params: {} };
  return {
    key: ref.slice(0, at),
    params: Object.fromEntries(new URLSearchParams(ref.slice(at + 1))),
  };
}

function lookup(catalog: ServerMessages, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function isMessageRef(ref: string): boolean {
  return lookup(serverMessagesEn, parseMessage(ref).key) !== undefined;
}

/**
 * Renders a message reference with a catalog: "validation.tooLong?max=255" →
 * "Too long (max 255 characters)". Text that is not a reference comes back unchanged
 * (e.g. Zod's own default messages for checks without a custom message).
 */
export function formatMessage(ref: string, catalog: ServerMessages = serverMessagesEn): string {
  const { key, params } = parseMessage(ref);
  const template = lookup(catalog, key);
  if (template === undefined) return ref;
  return template.replace(/{{(\w+)}}/g, (whole, name: string) => params[name] ?? whole);
}
