import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import { ApiError } from './api/errors';
import { App } from './App';
import { ToastProvider } from './components/toast';
import { AuthProvider } from './features/auth/auth-context';
import './i18n';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx never helps (bad input, not found, no permission).
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Remount the app when the language changes, so EVERY component re-renders in the new
 * language — including ones that only format dates or money and never call useTranslation.
 * Server data survives in the TanStack Query cache; auth state lives above this key.
 */
function LocalizedApp() {
  const { i18n } = useTranslation();
  return <App key={i18n.resolvedLanguage} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LocalizedApp />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
