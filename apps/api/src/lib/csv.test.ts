import { describe, expect, it } from 'vitest';
import { csvCell, csvRow, UTF8_BOM } from './csv.js';

describe('csvCell', () => {
  it('leaves plain values alone and empties null', () => {
    expect(csvCell('ข้าวมันไก่')).toBe('ข้าวมันไก่');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes values with commas, quotes or line breaks (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises formula injection in text cells', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('never alters numeric cells (negative amounts stay numbers)', () => {
    expect(csvCell('-120.50', { numeric: true })).toBe('-120.50');
  });
});

describe('csvRow', () => {
  it('joins cells and ends with CRLF', () => {
    expect(csvRow(['a', 'b'])).toBe('a,b\r\n');
    expect(UTF8_BOM).toBe('\uFEFF');
  });
});
