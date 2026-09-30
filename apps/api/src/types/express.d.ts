export interface AuthUser {
  id: bigint;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. Undefined on public routes. */
      user?: AuthUser;
    }
  }
}
