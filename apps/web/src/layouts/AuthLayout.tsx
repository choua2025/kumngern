import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Before login there is no profile yet: the language is chosen here. */}
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="rounded-2xl bg-blue-600 p-3 text-white">
            <Wallet className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.tagline')}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          {children}
        </div>
      </div>
    </main>
  );
}
