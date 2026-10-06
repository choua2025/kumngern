import type {
  AuthResponse,
  CurrencyDto,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UserDto,
} from '@income-expenses/shared';
import { useQuery } from '@tanstack/react-query';
import { api, authHttp, setAccessToken } from './client';
import { toApiError } from './errors';
import { queryKeys } from './query-keys';

async function authCall<T>(request: Promise<{ data: { data: T } }>): Promise<T> {
  try {
    return (await request).data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function login(input: LoginInput): Promise<UserDto> {
  const session = await authCall(authHttp.post<{ data: AuthResponse }>('/auth/login', input));
  setAccessToken(session.accessToken);
  return session.user;
}

export async function register(input: RegisterInput): Promise<UserDto> {
  const session = await authCall(authHttp.post<{ data: AuthResponse }>('/auth/register', input));
  setAccessToken(session.accessToken);
  return session.user;
}

/** Always 202 for a valid email — the API never says whether the address has an account. */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  try {
    await authHttp.post('/auth/forgot-password', input);
  } catch (error) {
    throw toApiError(error);
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  try {
    await authHttp.post('/auth/reset-password', input);
  } catch (error) {
    throw toApiError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await authHttp.post('/auth/logout');
  } finally {
    // Forget the token even if the network call failed.
    setAccessToken(null);
  }
}

export async function fetchMe(): Promise<UserDto> {
  return (await api.get<{ data: UserDto }>('/auth/me')).data.data;
}

export function useCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies,
    queryFn: async () => (await api.get<{ data: CurrencyDto[] }>('/currencies')).data.data,
    staleTime: Infinity, // reference data
  });
}
