import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { i18n } from '../i18n';

// jsdom reports navigator.languages = ['en-US']; existing tests assert the Thai UI.
// Tests for other languages switch explicitly (see i18n.test.tsx).
void i18n.changeLanguage('th');

afterEach(() => {
  cleanup();
  localStorage.clear();
  void i18n.changeLanguage('th');
});

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
