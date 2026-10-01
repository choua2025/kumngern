/**
 * Where to go after login. Only same-app paths are allowed: "//evil.com" and
 * "/\evil.com" are treated by browsers as OTHER sites (open redirect), so they fall back.
 */
export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
