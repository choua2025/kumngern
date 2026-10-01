// Apply the theme before first paint (no light → dark flash). Loaded as a blocking
// <script src> instead of an inline script so the CSP can stay "script-src 'self'".
try {
  var saved = localStorage.getItem('theme');
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}
