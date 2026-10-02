import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { formatDate, formatDateTime, formatMonthLong, formatMonthShort } from '../lib/date';
import { formatMoney } from '../lib/money';
import { detectLocale, i18n, intlLocale, setLocale } from './index';
import { en } from './locales/en';
import { lo } from './locales/lo';
import { th } from './locales/th';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const reference = flatten(en);

  for (const [name, messages] of [
    ['th', th],
    ['lo', lo],
  ] as const) {
    it(`${name}: every key is translated with the same {{placeholders}} as English`, () => {
      const flat = flatten(messages);
      expect([...flat.keys()].sort()).toEqual([...reference.keys()].sort());
      for (const [key, english] of reference) {
        const text = flat.get(key) ?? '';
        expect(text.trim(), `${name}.${key} is empty`).not.toBe('');
        // A dropped {{name}} would silently show a sentence without the name.
        expect(placeholders(text), `${name}.${key}`).toEqual(placeholders(english));
      }
    });
  }

  it('Lao text is really Lao script, not Thai copied over', () => {
    const thaiScript = /[฀-๿]/;
    const offenders = [...flatten(lo)].filter(
      ([key, text]) => key !== 'language.th' && thaiScript.test(text),
    );
    expect(offenders).toEqual([]);
  });
});

describe('detectLocale', () => {
  it('prefers the saved choice, then the browser languages, then Thai', () => {
    expect(detectLocale('lo', ['en-US'])).toBe('lo');
    expect(detectLocale('xx', ['lo-LA', 'en'])).toBe('lo');
    expect(detectLocale(null, ['en-GB'])).toBe('en');
    expect(detectLocale(null, ['fr-FR', 'de'])).toBe('th');
    expect(detectLocale(null, [])).toBe('th');
  });
});

describe('locale-aware formatting', () => {
  it('formats dates and money in the UI language', async () => {
    await setLocale('th');
    expect(intlLocale()).toBe('th-TH');
    expect(formatMonthLong('2026-09')).toBe('กันยายน 2569'); // Buddhist era

    await setLocale('en');
    expect(formatMonthLong('2026-09')).toBe('September 2026');
    expect(formatMoney('1234.5', 'USD')).toBe('$1,234.50');

    await setLocale('lo');
    expect(intlLocale()).toBe('lo-LA');
  });

  it('formats Lao dates from its own CLDR table — identical on browsers without Lao Intl data', async () => {
    // Chromium has no Lao ICU data and would print "October 2026"; ours does not depend on it.
    await setLocale('lo');
    expect(formatMonthLong('2026-09')).toBe('ກັນຍາ 2026');
    expect(formatMonthShort('2026-10')).toBe('ຕ.ລ. 26');
    // 2026-10-04T17:30Z is already 5 Oct 00:30 in Bangkok (the user's timezone wins).
    expect(formatDate('2026-10-04T17:30:00Z', 'Asia/Bangkok')).toBe('5 ຕ.ລ. 2026');
    expect(formatDateTime('2026-10-04T17:30:00Z', 'Asia/Bangkok')).toBe('5 ຕ.ລ. 2026, 00:30');
    // Numbers are pinned to en-US grouping for Lao (see intlNumberLocale).
    expect(formatMoney('1234567', 'LAK', 0)).toBe('₭1,234,567');
  });
});

describe('<LanguageSwitcher>', () => {
  function Greeting() {
    const { t } = useTranslation();
    return <p>{t('auth.login')}</p>;
  }

  it('switches the UI, <html lang> and remembers the choice', async () => {
    const user = userEvent.setup();
    render(
      <>
        <LanguageSwitcher />
        <Greeting />
      </>,
    );
    expect(screen.getByText('เข้าสู่ระบบ')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'lo');
    expect(await screen.findByText('ເຂົ້າສູ່ລະບົບ')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('lo');
    expect(localStorage.getItem('locale')).toBe('lo');

    await user.selectOptions(screen.getByRole('combobox'), 'en');
    expect(await screen.findByText('Log in')).toBeInTheDocument();
    expect(i18n.resolvedLanguage).toBe('en');
  });
});
