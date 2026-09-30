import type { LoginInput, RegisterInput, UserDto } from '@income-expenses/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as authApi from '../../api/auth';
import { refreshAccessToken, setSessionExpiredHandler } from '../../api/client';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: UserDto };

export interface AuthContextValue {
  state: AuthState;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace the cached user after a profile change. */
  setUser: (user: UserDto) => void;
}

/** Exported for tests, which provide a fixed user instead of the silent-login flow. */
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const queryClient = useQueryClient();

  const becomeAnonymous = useCallback(() => {
    setState({ status: 'anonymous', user: null });
    // Never show the previous user's data to the next person on this device.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(becomeAnonymous);

    // Silent login: the access token lived in memory and was lost on reload, but the
    // httpOnly refresh cookie survives. In StrictMode this effect runs twice; the
    // single-flight refresh in api/client.ts makes that one request, not two.
    let cancelled = false;
    refreshAccessToken()
      .then(() => authApi.fetchMe())
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [becomeAnonymous]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (input) => {
        const user = await authApi.login(input);
        setState({ status: 'authenticated', user });
      },
      register: async (input) => {
        const user = await authApi.register(input);
        setState({ status: 'authenticated', user });
      },
      logout: async () => {
        await authApi.logout();
        becomeAnonymous();
      },
      setUser: (user) => setState({ status: 'authenticated', user }),
    }),
    [state, becomeAnonymous],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** For pages behind <RequireAuth>: the user is guaranteed to exist. */
export function useCurrentUser(): UserDto {
  const { state } = useAuth();
  if (state.status !== 'authenticated') {
    throw new Error('useCurrentUser used outside an authenticated route');
  }
  return state.user;
}
