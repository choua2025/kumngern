import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { categoryName } from './category-name';

afterEach(async () => {
  await setLocale('th');
});

describe('categoryName', () => {
  it('translates system categories from their systemKey', async () => {
    const food = { name: 'อาหาร', systemKey: 'food' };
    expect(categoryName(food)).toBe('อาหาร');
    await setLocale('en');
    expect(categoryName(food)).toBe('Food');
    await setLocale('lo');
    expect(categoryName(food)).toBe('ອາຫານ');
  });

  it("keeps the user's own category name exactly as typed", async () => {
    await setLocale('en');
    expect(categoryName({ name: 'ค่าขนมลูก', systemKey: null })).toBe('ค่าขนมลูก');
  });

  it('shows the stored name for a system key this build does not know', async () => {
    await setLocale('en');
    expect(categoryName({ name: 'ภาษี', systemKey: 'tax' })).toBe('ภาษี');
  });
});
