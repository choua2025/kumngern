/**
 * Process-wide lifecycle state. Set to true on SIGTERM so /ready starts
 * returning 503 while in-flight requests finish.
 */
export const lifecycle = {
  isShuttingDown: false,
};
