import { lazy, type ReactNode, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { LoadingRows } from './components/states';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { RedirectIfAuthenticated, RequireAuth } from './features/auth/RequireAuth';
import { AppLayout } from './layouts/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';

// Code-split per page: the login screen does not download the chart library.
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const WalletsPage = lazy(() =>
  import('./features/wallets/WalletsPage').then((m) => ({ default: m.WalletsPage })),
);
const CategoriesPage = lazy(() =>
  import('./features/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);
const BudgetsPage = lazy(() =>
  import('./features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })),
);
const RecurringPage = lazy(() =>
  import('./features/recurring/RecurringPage').then((m) => ({ default: m.RecurringPage })),
);
const ReportsPage = lazy(() =>
  import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const TransactionsPage = lazy(() =>
  import('./features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
);

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingRows rows={6} />}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <Page>
              <DashboardPage />
            </Page>
          }
        />
        <Route
          path="transactions"
          element={
            <Page>
              <TransactionsPage />
            </Page>
          }
        />
        <Route
          path="wallets"
          element={
            <Page>
              <WalletsPage />
            </Page>
          }
        />
        <Route
          path="categories"
          element={
            <Page>
              <CategoriesPage />
            </Page>
          }
        />
        <Route
          path="budgets"
          element={
            <Page>
              <BudgetsPage />
            </Page>
          }
        />
        <Route
          path="recurring"
          element={
            <Page>
              <RecurringPage />
            </Page>
          }
        />
        <Route
          path="reports"
          element={
            <Page>
              <ReportsPage />
            </Page>
          }
        />
        <Route
          path="settings"
          element={
            <Page>
              <SettingsPage />
            </Page>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
