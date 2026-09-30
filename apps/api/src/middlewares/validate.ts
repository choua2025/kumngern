import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { type ErrorDetail, errors } from '../lib/errors.js';

export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Output<S, Fallback> = S extends z.ZodType ? z.output<S> : Fallback;

/**
 * Request type after `validate(schemas)` has run: params/query/body carry the
 * parsed (coerced, defaulted, transformed) Zod output instead of raw strings.
 */
export type ValidatedRequest<S extends RequestSchemas> = Request<
  Output<S['params'], Request['params']>,
  unknown,
  Output<S['body'], unknown>,
  Output<S['query'], Request['query']>
>;

const PARTS = ['params', 'query', 'body'] as const;
type Part = (typeof PARTS)[number];

export function zodIssuesToDetails(
  issues: readonly z.core.$ZodIssue[],
  prefix?: Part,
): ErrorDetail[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    // Body fields are reported as-is ("amount"); params/query are prefixed ("query.page").
    const fullPath = prefix && prefix !== 'body' ? [prefix, path].filter(Boolean).join('.') : path;
    return { path: fullPath, message: issue.message };
  });
}

/**
 * Validates params, query and body with Zod (engineering rule 6).
 * On success the parsed values replace the raw ones, so handlers only ever see
 * validated data. On failure, all problems from all parts are reported at once.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        // Express 4 exposes these as plain writable properties.
        (req as Record<Part, unknown>)[part] = result.data;
      } else {
        details.push(...zodIssuesToDetails(result.error.issues, part));
      }
    }

    if (details.length > 0) {
      next(errors.validation(undefined, details));
      return;
    }
    next();
  };
}
