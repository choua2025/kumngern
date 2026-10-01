// Apply the theme before first paint (no light → dark flash). Loaded as a blocking
// <script src> instead of an inline script so the CSP can stay "script-src 'self'".
try {
  const saved = globalThis.localStorage.getItem('theme');
  const dark = saved
    ? saved === 'dark'
    : globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  globalThis.document.documentElement.classList.toggle('dark', dark);
} catch {
  // Storage blocked (private mode, policies): keep the light theme.
}
