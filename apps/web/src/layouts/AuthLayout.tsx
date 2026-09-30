import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="rounded-2xl bg-blue-600 p-3 text-white">
            <Wallet className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            รู้ว่าเงินไปไหน ทุกกระเป๋าในที่เดียว
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          {children}
        </div>
      </div>
    </main>
  );
}
