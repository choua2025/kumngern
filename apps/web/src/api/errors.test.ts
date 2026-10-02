import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { translateMessage } from '../i18n/use-message';
import { toApiError } from './errors';

function apiFailure(status: number, error: Record<string, unknown>): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data: { error },
  } as AxiosResponse;
  return new AxiosError('failed', String(status), config, null, response);
}

afterEach(async () => {
  await setLocale('th');
});

describe('API errors in the user language', () => {
  it('translates error.key, with parameters, instead of the English text', async () => {
    const failure = apiFailure(409, {
      code: 'CONFLICT',
      key: 'errors.walletArchived?name=BCEL',
      message: 'Wallet "BCEL" is archived — new transactions cannot be added',
    });

    await setLocale('lo');
    expect(toApiError(failure).message).toBe(
      'ກະເປົາ "BCEL" ຖືກເກັບເຂົ້າຄັງແລ້ວ ບັນທຶກລາຍການບໍ່ໄດ້',
    );

    await setLocale('th');
    expect(toApiError(failure).message).toBe('กระเป๋า "BCEL" ถูก archive แล้ว บันทึกรายการไม่ได้');
  });

  it('falls back to the English text when there is no key (or an unknown one)', () => {
    expect(
      toApiError(apiFailure(503, { code: 'INTERNAL_ERROR', message: 'Database unavailable' }))
        .message,
    ).toBe('Database unavailable');
    expect(
      toApiError(
        apiFailure(400, { code: 'VALIDATION_ERROR', key: 'errors.fromTheFuture', message: 'New' }),
      ).message,
    ).toBe('New');
  });

  it('translates field details by key', async () => {
    await setLocale('en');
    expect(translateMessage('validation.tooLong?max=255')).toBe('Too long (max 255 characters)');
    expect(translateMessage('Some plain text')).toBe('Some plain text');
  });
});
