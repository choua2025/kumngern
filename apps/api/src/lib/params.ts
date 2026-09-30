import { idSchema } from '@income-expenses/shared';
import { z } from 'zod';

/** `/:id` route parameter → bigint. A non-numeric id is a 400, not a 500 from Postgres. */
export const idParamsSchema = z.object({
  id: idSchema.transform((value) => BigInt(value)),
});

/** Converts an optional/nullable id string from a request body to bigint. */
export function toBigIntId(value: string): bigint;
export function toBigIntId(value: string | null | undefined): bigint | null;
export function toBigIntId(value: string | null | undefined): bigint | null {
  return value === null || value === undefined ? null : BigInt(value);
}

/**
 * Escapes LIKE/ILIKE wildcards so user input is matched literally.
 * Prisma's `contains` wraps the value in %...% but does NOT escape % and _ inside it:
 * searching "100%" would otherwise also match "1000".
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
