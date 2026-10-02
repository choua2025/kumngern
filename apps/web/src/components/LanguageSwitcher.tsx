import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { currentLocale, isLocale, LOCALES, setLocale } from '../i18n';
import { cn } from '../lib/cn';

/**
 * Language picker. Each option is written in its OWN language ("ລາວ", "English", "ไทย"),
 * so a user who cannot read the current UI language can still find theirs.
 */
export function LanguageSwitcher({
  className,
  onChange,
}: {
  className?: string;
  /** Called after the switch, e.g. to save the choice to the user's profile. */
  onChange?: (locale: (typeof LOCALES)[number]) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <Languages className="size-4 text-slate-500" aria-hidden />
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={currentLocale()}
        onChange={(event) => {
          const locale = event.target.value;
          if (!isLocale(locale)) return;
          void setLocale(locale).then(() => onChange?.(locale));
        }}
        className="rounded-lg border-0 bg-transparent py-1 pr-7 pl-1 text-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 dark:ring-slate-700"
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale} lang={locale}>
            {t(`language.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
