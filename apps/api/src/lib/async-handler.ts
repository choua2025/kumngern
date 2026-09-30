import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not catch rejected promises from async handlers: an error thrown
 * after an `await` becomes an unhandledRejection and the request hangs forever.
 * This wrapper forwards the rejection to `next(err)` → the central error handler.
 *
 * The generic `Req` lets handlers declare the shape produced by the `validate`
 * middleware that runs before them (see `ValidatedRequest`).
 */
export function asyncHandler<Req extends Request<object, unknown, unknown, object> = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as unknown as Req, res, next).catch(next);
  };
}
