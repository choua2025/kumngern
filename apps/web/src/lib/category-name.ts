import { i18n } from '../i18n';

/**
 * What to show for a category: SYSTEM categories ("food", "salary") are translated from
 * their systemKey; categories the user created keep exactly the name they typed.
 */
export function categoryName(category: { name: string; systemKey: string | null }): string {
  if (!category.systemKey) return category.name;
  const key = `systemCategories.${category.systemKey}`;
  // A key this build does not know (e.g. a category added by a newer API) shows the DB name.
  const t = i18n.t as unknown as (key: string) => string;
  return i18n.exists(key) ? t(key) : category.name;
}
