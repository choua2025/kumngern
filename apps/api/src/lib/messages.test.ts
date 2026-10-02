import {
  formatMessage,
  isMessageRef,
  msg,
  parseMessage,
  serverMessagesLo,
  serverMessagesTh,
} from '@income-expenses/shared';
import { describe, expect, it } from 'vitest';
import { AppError, errors } from './errors.js';

describe('message references', () => {
  it('round-trips parameters, including characters that need encoding', () => {
    const ref = msg('errors.walletArchived', { name: 'เงินสด & co = 50%' });
    expect(ref.startsWith('errors.walletArchived?')).toBe(true);
    expect(parseMessage(ref)).toEqual({
      key: 'errors.walletArchived',
      params: { name: 'เงินสด & co = 50%' },
    });
    expect(formatMessage(ref)).toBe(
      'Wallet "เงินสด & co = 50%" is archived — new transactions cannot be added',
    );
  });

  it('renders any catalog and leaves plain text untouched', () => {
    expect(formatMessage(msg('validation.tooLong', { max: 255 }), serverMessagesTh)).toBe(
      'ยาวเกินไป (สูงสุด 255 ตัวอักษร)',
    );
    expect(formatMessage('errors.walletNotFound', serverMessagesLo)).toBe('ບໍ່ພົບກະເປົາເງິນ');
    expect(formatMessage('Too small: expected string to have >=1 characters')).toBe(
      'Too small: expected string to have >=1 characters',
    );
    expect(isMessageRef('validation.amountInvalid')).toBe(true);
    expect(isMessageRef('validation.noSuchKey')).toBe(false);
  });
});

describe('AppError', () => {
  it('carries English text for any client and the key for translation', () => {
    const error = errors.conflict('errors.walletArchived', { name: 'Cash' });
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Wallet "Cash" is archived — new transactions cannot be added');
    expect(error.key).toBe('errors.walletArchived?name=Cash');
  });

  it('has no key for plain text (e.g. readiness errors)', () => {
    const error = new AppError('INTERNAL_ERROR', 'Database unavailable', { status: 503 });
    expect(error.key).toBeUndefined();
    expect(error.message).toBe('Database unavailable');
  });
});
