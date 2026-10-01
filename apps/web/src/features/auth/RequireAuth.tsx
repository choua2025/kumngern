import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Skeleton } from '../../components/states';
import { safeRedirectPath } from '../../lib/safe-redirect';
import { useAuth } from './auth-context';

/** Protected route: not logged in → /login, remembering where the user wanted to go. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-label="กำลังตรวจสอบการเข้าสู่ระบบ"
        className="mx-auto max-w-5xl space-y-4 p-6"
      >
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/**
 * For /login and /register: once the user is authenticated (already, or by submitting
 * the form) go to the page they originally asked for. This is the ONLY place that
 * redirects after login — a second navigate() in the form would race with this one.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'authenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeRedirectPath(from)} replace />;
  }
  return children;
}
