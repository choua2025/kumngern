/**
 * localStorage for UI PREFERENCES only (theme, last-used wallet).
 * Never tokens: anything here is readable by any script on the page (XSS).
 * Access can throw (private mode, blocked storage), so every call is guarded.
 */
export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference is a convenience; ignore storage failures.
  }
}
