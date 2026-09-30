import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
  action?: { label: string; onClick: () => void } | undefined;
}

interface ToastApi {
  show: (message: string, options?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;
const DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, options = {}) => {
      const id = nextId++;
      setToasts((current) => [
        ...current.slice(-2),
        { id, message, tone: options.tone ?? 'success', action: options.action },
      ]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live: screen readers announce new toasts without moving focus */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2
                className="size-5 shrink-0 text-emerald-400 dark:text-emerald-600"
                aria-hidden
              />
            ) : (
              <XCircle className="size-5 shrink-0 text-red-400 dark:text-red-600" aria-hidden />
            )}
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="font-semibold text-blue-300 hover:underline dark:text-blue-700"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
