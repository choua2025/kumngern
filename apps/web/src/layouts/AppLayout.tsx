import {
  ArrowLeftRight,
  ChartPie,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Moon,
  PiggyBank,
  Plus,
  Settings,
  Sun,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { QuickAddModal } from '../features/quick-add/QuickAddModal';
import { useHotkey } from '../features/quick-add/use-hotkey';
import { cn } from '../lib/cn';
import { currentTheme, setTheme, type Theme } from '../lib/theme';

const NAV = [
  { to: '/', label: 'แดชบอร์ด', icon: LayoutDashboard, mobile: true },
  { to: '/transactions', label: 'รายการ', icon: ArrowLeftRight, mobile: true },
  { to: '/wallets', label: 'กระเป๋า', icon: Wallet, mobile: true },
  { to: '/budgets', label: 'งบประมาณ', icon: PiggyBank, mobile: true },
  { to: '/reports', label: 'รายงาน', icon: ChartPie, mobile: false },
  { to: '/categories', label: 'หมวดหมู่', icon: FolderTree, mobile: false },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings, mobile: true },
] as const;

function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        setThemeState(next);
      }}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
    >
      {theme === 'dark' ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </button>
  );
}

export function AppLayout() {
  const { state, logout } = useAuth();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  useHotkey('n', () => setQuickAddOpen(true));

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-2 font-bold">
          <span className="rounded-lg bg-blue-600 p-1.5 text-white">
            <Wallet className="size-4" aria-hidden />
          </span>
          Income & Expenses
        </div>
        <nav aria-label="เมนูหลัก" className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="truncate px-2 text-sm text-slate-500">{state.user?.email}</p>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut className="size-4" aria-hidden /> ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <span className="py-3 font-bold">Income & Expenses</span>
          <div className="flex items-center">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 sm:px-6 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Floating "+" (Quick Add) — also on the N key */}
      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:right-8 lg:bottom-8"
        aria-label="เพิ่มรายการ (คีย์ลัด N)"
        title="เพิ่มรายการ (N)"
      >
        <Plus className="size-7" aria-hidden />
      </button>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {NAV.filter((item) => item.mobile).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500',
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
}
