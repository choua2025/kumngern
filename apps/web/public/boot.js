// Runs before the app bundle (a blocking classic <script src>, not inline, so the CSP can
// stay "script-src 'self'"). Keep it tiny: it delays first paint.

// 1. Zod: our CSP has no 'unsafe-eval'. Zod v4 probes `new Function('')` the first time a
//    z.object() is CREATED — at import time of packages/shared, before any app code could
//    call z.config(). The probe is caught, but the browser still reports a CSP violation on
//    every page load. Zod reads this global on startup, so setting it here comes first.
globalThis.__zod_globalConfig = Object.assign(globalThis.__zod_globalConfig || {}, {
  jitless: true,
});

// 2. Theme before first paint (no light → dark flash).
try {
  const saved = globalThis.localStorage.getItem('theme');
  const dark = saved
    ? saved === 'dark'
    : globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  globalThis.document.documentElement.classList.toggle('dark', dark);
} catch {
  // Storage blocked (private mode, policies): keep the light theme.
}
