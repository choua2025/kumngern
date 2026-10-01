import { describe, expect, it } from 'vitest';
import { addDays, localDateRangeToUtc, startOfLocalDay, toLocalDateTime } from './time.js';

describe('startOfLocalDay', () => {
  it('Asia/Bangkok (UTC+7): local midnight is 17:00 UTC the previous day', () => {
    expect(startOfLocalDay('2026-10-01', 'Asia/Bangkok').toISOString()).toBe(
      '2026-09-30T17:00:00.000Z',
    );
  });

  it('UTC is unchanged', () => {
    expect(startOfLocalDay('2026-10-01', 'UTC').toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('handles negative offsets (America/Los_Angeles, PDT = UTC-7)', () => {
    expect(startOfLocalDay('2026-07-15', 'America/Los_Angeles').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z',
    );
  });

  it('handles daylight-saving switch days (America/New_York)', () => {
    // 2026-03-08: clocks jump 02:00 → 03:00; midnight is still EST (UTC-5)
    expect(startOfLocalDay('2026-03-08', 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    // 2026-03-09: first full day of EDT (UTC-4)
    expect(startOfLocalDay('2026-03-09', 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
    // 2026-11-01: clocks fall back 02:00 → 01:00; midnight is still EDT (UTC-4)
    expect(startOfLocalDay('2026-11-01', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries, including leap years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('localDateRangeToUtc', () => {
  it('turns an inclusive local range into a half-open UTC range', () => {
    const range = localDateRangeToUtc('2026-09-01', '2026-09-30', 'Asia/Bangkok');

    expect(range.gte?.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    // "to" is inclusive → the range ends at the START of the next day
    expect(range.lt?.toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('omits missing bounds', () => {
    expect(localDateRangeToUtc(undefined, undefined, 'UTC')).toEqual({});
  });
});

describe('toLocalDateTime', () => {
  it('formats an instant as the wall clock of the timezone', () => {
    const instant = new Date('2026-09-30T17:30:00Z');

    expect(toLocalDateTime(instant, 'Asia/Bangkok')).toEqual({ date: '2026-10-01', time: '00:30' });
    expect(toLocalDateTime(instant, 'UTC')).toEqual({ date: '2026-09-30', time: '17:30' });
  });
});
