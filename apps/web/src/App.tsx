import { lazy, type ReactNode, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoadingRows } from './components/states';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { RedirectIfAuthenticated, RequireAuth } from './features/auth/RequireAuth';
import { AppLayout } from './layouts/AppLayout';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Code-split per page: the login screen does not download the chart library.
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
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
        <Route path="wallets" element={<ComingSoonPage title="กระเป๋าเงิน" />} />
        <Route path="categories" element={<ComingSoonPage title="หมวดหมู่" />} />
        <Route path="budgets" element={<ComingSoonPage title="งบประมาณ" />} />
        <Route path="reports" element={<ComingSoonPage title="รายงาน" />} />
        <Route path="settings" element={<ComingSoonPage title="ตั้งค่า" />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
