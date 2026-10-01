import { describe, expect, it } from 'vitest';
import { filenameFromDisposition } from './download';

describe('filenameFromDisposition', () => {
  it('reads the filename from Content-Disposition', () => {
    expect(
      filenameFromDisposition('attachment; filename="transactions-2026-10-01.csv"', 'x.csv'),
    ).toBe('transactions-2026-10-01.csv');
    expect(filenameFromDisposition('attachment; filename=report.csv', 'x.csv')).toBe('report.csv');
  });

  it('falls back when the header is missing', () => {
    expect(filenameFromDisposition(undefined, 'fallback.csv')).toBe('fallback.csv');
  });
});
