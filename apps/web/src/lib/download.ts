/** `attachment; filename="transactions-2026-10-01.csv"` → `transactions-2026-10-01.csv` */
export function filenameFromDisposition(header: string | undefined, fallback: string): string {
  const match = /filename="?([^";]+)"?/i.exec(header ?? '');
  return match?.[1] ?? fallback;
}

/**
 * Saves a Blob as a file. The API needs the in-memory Bearer token, so a plain
 * <a href="/api/..."> cannot be used — the file is fetched with axios, then handed over.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
