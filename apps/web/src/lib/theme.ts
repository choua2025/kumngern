import { readPreference, writePreference } from './storage';

export type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** index.html applies the saved theme before first paint; this switches it at runtime. */
export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  writePreference('theme', theme);
}

export function hasSavedTheme(): boolean {
  return readPreference('theme') !== null;
}
