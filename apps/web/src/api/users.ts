import type {
  AccessTokenResponse,
  ChangePasswordInput,
  Locale,
  UpdateProfileInput,
  UserDto,
} from '@income-expenses/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken } from './client';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) =>
      (await api.patch<{ data: UserDto }>('/users/me', input)).data.data,
    // Default currency and timezone change every report and budget figure.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Saves the UI language on the account (no refetch: language does not change any data). */
export async function saveLocale(locale: Locale): Promise<UserDto> {
  return (await api.patch<{ data: UserDto }>('/users/me', { locale })).data.data;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const response = await api.patch<{ data: AccessTokenResponse }>('/users/me/password', input);
      // Other devices are logged out; this one gets a fresh session (design-doc X6).
      setAccessToken(response.data.data.accessToken);
    },
  });
}
