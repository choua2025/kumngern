import type { UserDto } from '@income-expenses/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '../components/toast';
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context';

export const TEST_USER: UserDto = {
  id: '1',
  email: 'test@example.com',
  displayName: 'Tester',
  defaultCurrency: 'THB',
  timezone: 'Asia/Bangkok',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Renders a page with every provider it needs and a logged-in test user. */
export function renderPage(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'authenticated', user: TEST_USER },
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    setUser: () => undefined,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
