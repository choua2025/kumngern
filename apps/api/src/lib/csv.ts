/**
 * RFC 4180 CSV cells, safe to open in Excel / Google Sheets.
 *
 * CSV (formula) injection: a cell such as `=HYPERLINK("http://evil","click")` is executed
 * as a formula by spreadsheet apps. Text cells that start with = + - @ (or tab/CR) get a
 * leading apostrophe so they are shown as text. Numeric columns are never touched —
 * "-120.50" must stay a negative number.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(
  value: string | null | undefined,
  options: { numeric?: boolean } = {},
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const safe = !options.numeric && FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(cells: string[]): string {
  // CRLF line endings: what RFC 4180 specifies and what Excel expects.
  return `${cells.join(',')}\r\n`;
}

/** UTF-8 byte order mark — without it Excel guesses the encoding and Thai text is garbled. */
export const UTF8_BOM = '\uFEFF';
